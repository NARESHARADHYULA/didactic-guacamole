using System.Text.Json;
using Api.Models;
using Elastic.Clients.Elasticsearch;
using Elastic.Transport;

namespace Api.Services;

/// <summary>
/// Service that handles the full reindex workflow:
/// 1. Retrieve current indices for the alias
/// 2. Create a new timestamped index (schema copied from last index, or fallback to local file on first run)
/// 3. Bulk index articles into the new index
/// 4. Atomically swap the alias to the new index
/// 5. Verify the alias resolves correctly
/// 6. Delete the old index(es)
/// </summary>
public class ElasticIndexingService
{
    private readonly ElasticsearchClient _client;
    private readonly IConfiguration _config;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<ElasticIndexingService> _logger;
    private readonly IArticleRepository _articleRepository;

    public ElasticIndexingService(
        ElasticsearchClient client,
        IConfiguration config,
        IWebHostEnvironment env,
        ILogger<ElasticIndexingService> logger,
        IArticleRepository articleRepository)
    {
        _client = client;
        _config = config;
        _env = env;
        _logger = logger;
        _articleRepository = articleRepository;
    }

    public async Task<bool> RunReindexAsync(CancellationToken cancellationToken = default)
    {
        var baseName = _config["Elasticsearch:IndexName"] ?? "articles";
        var aliasName = _config["Elasticsearch:AliasName"] ?? baseName;
        var timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
        var newIndexName = $"{baseName}_{timestamp}";

        _logger.LogInformation(
            "=== Reindex Run Started at {Time} UTC ===", DateTime.UtcNow);
        _logger.LogInformation(
            "Configuration: BaseName={BaseName}, AliasName={Alias}, NewIndex={NewIndex}",
            baseName, aliasName, newIndexName);

        try
        {
            // Step 1: Get old indices currently pointed to by the alias (needed before index creation to copy schema)
            var oldIndices = await GetIndicesForAliasAsync(aliasName);

            // Step 2: Create new index with schema from last index (or fallback to local file on first run)
            if (!await CreateNewIndexAsync(newIndexName, oldIndices, cancellationToken))
                return false;

            // Step 3: Fetch and bulk-index articles
            if (!await IndexArticlesAsync(newIndexName, cancellationToken))
            {
                await DeleteIndexSafeAsync(newIndexName);
                return false;
            }

            // Step 4: Atomically update alias to point to the new index
            if (!await UpdateAliasAsync(aliasName, newIndexName, oldIndices))
            {
                _logger.LogError("Failed to update alias. Cleaning up new index '{NewIndex}'.", newIndexName);
                await DeleteIndexSafeAsync(newIndexName);
                return false;
            }

            // Step 5: Verify the alias resolves correctly
            if (!await VerifyAliasAsync(aliasName))
            {
                _logger.LogError(
                    "Alias verification failed! The alias '{Alias}' may not be working correctly. Manual intervention required.",
                    aliasName);
                return false;
            }

            // Step 6: Delete old indices
            await DeleteOldIndicesAsync(oldIndices);

            _logger.LogInformation(
                "=== Reindex Run Completed Successfully. Alias '{Alias}' now points to '{NewIndex}'. ===",
                aliasName, newIndexName);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Reindex run failed with an unhandled exception.");
            return false;
        }
    }

    private async Task<bool> CreateNewIndexAsync(string indexName, List<string> existingIndices, CancellationToken cancellationToken)
    {
        _logger.LogInformation("[Step 2/6] Creating new index '{IndexName}'...", indexName);

        string? schemaJson = null;

        // Try to fetch schema from the last existing index
        if (existingIndices.Count > 0)
        {
            var sourceIndex = existingIndices[^1];
            schemaJson = await GetSchemaFromExistingIndexAsync(sourceIndex);
        }

        // Fallback to local file on first run when no previous index exists
        if (schemaJson is null)
        {
            _logger.LogInformation("[Step 2/6] No existing index found to copy schema from. Falling back to local 'elastic-index.json'.");
            var schemaPath = Path.Combine(_env.ContentRootPath, "elastic-index.json");
            if (!File.Exists(schemaPath))
            {
                _logger.LogError(
                    "[Step 2/6] Fallback schema file not found at '{Path}'. Ensure 'elastic-index.json' exists in the project root and is set to CopyToOutputDirectory.",
                    schemaPath);
                return false;
            }
            schemaJson = await File.ReadAllTextAsync(schemaPath, cancellationToken);
            _logger.LogInformation("[Step 2/6] Loaded schema from local file '{Path}'.", schemaPath);
        }

        var response = await _client.Transport.PutAsync<StringResponse>(
            $"/{indexName}", PostData.String(schemaJson));

        if (!response.ApiCallDetails.HasSuccessfulStatusCode)
        {
            _logger.LogError(
                "[Step 2/6] Failed to create index '{IndexName}'. Status: {Status}, Response: {Body}",
                indexName, response.ApiCallDetails.HttpStatusCode, response.Body);
            return false;
        }

        _logger.LogInformation("[Step 2/6] Index '{IndexName}' created successfully.", indexName);
        return true;
    }

    /// <summary>
    /// Fetches settings and mappings from an existing index and builds a JSON body
    /// suitable for creating a new index with the same schema.
    /// </summary>
    private async Task<string?> GetSchemaFromExistingIndexAsync(string sourceIndex)
    {
        _logger.LogInformation(
            "[Step 2/6] Fetching schema (settings + mappings) from existing index '{SourceIndex}'...", sourceIndex);

        try
        {
            // Fetch settings and mappings from the source index
            var settingsResponse = await _client.Transport.GetAsync<StringResponse>($"/{sourceIndex}/_settings");
            var mappingsResponse = await _client.Transport.GetAsync<StringResponse>($"/{sourceIndex}/_mappings");

            if (!settingsResponse.ApiCallDetails.HasSuccessfulStatusCode)
            {
                _logger.LogWarning(
                    "[Step 2/6] Failed to fetch settings from '{SourceIndex}'. Status: {Status}.",
                    sourceIndex, settingsResponse.ApiCallDetails.HttpStatusCode);
                return null;
            }

            if (!mappingsResponse.ApiCallDetails.HasSuccessfulStatusCode)
            {
                _logger.LogWarning(
                    "[Step 2/6] Failed to fetch mappings from '{SourceIndex}'. Status: {Status}.",
                    sourceIndex, mappingsResponse.ApiCallDetails.HttpStatusCode);
                return null;
            }

            // Parse settings: response is { "index_name": { "settings": { "index": { ... } } } }
            using var settingsDoc = JsonDocument.Parse(settingsResponse.Body);
            var indexSettings = settingsDoc.RootElement
                .GetProperty(sourceIndex)
                .GetProperty("settings")
                .GetProperty("index");

            // Extract only user-defined settings, excluding auto-generated ones
            var cleanSettings = new Dictionary<string, object>();
            foreach (var prop in indexSettings.EnumerateObject())
            {
                // Skip Elasticsearch auto-managed settings that cannot be set on index creation
                if (prop.Name is "creation_date" or "creation_date_string" or "uuid"
                    or "version" or "provided_name" or "routing" or "history" or "lifecycle")
                    continue;

                cleanSettings[prop.Name] = JsonSerializer.Deserialize<JsonElement>(prop.Value.GetRawText());
            }

            // Parse mappings: response is { "index_name": { "mappings": { ... } } }
            using var mappingsDoc = JsonDocument.Parse(mappingsResponse.Body);
            var mappings = mappingsDoc.RootElement
                .GetProperty(sourceIndex)
                .GetProperty("mappings");

            // Build the create-index request body with settings nested under "index" and mappings
            var schema = new Dictionary<string, object>
            {
                ["settings"] = new Dictionary<string, object> { ["index"] = cleanSettings },
                ["mappings"] = JsonSerializer.Deserialize<JsonElement>(mappings.GetRawText())
            };

            var schemaJson = JsonSerializer.Serialize(schema);

            _logger.LogInformation(
                "[Step 2/6] Successfully fetched schema from existing index '{SourceIndex}'.", sourceIndex);
            return schemaJson;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "[Step 2/6] Exception while fetching schema from '{SourceIndex}'. Will fall back to local file.",
                sourceIndex);
            return null;
        }
    }

    private async Task<bool> IndexArticlesAsync(string indexName, CancellationToken cancellationToken)
    {
        _logger.LogInformation("[Step 3/6] Fetching articles from data source...");

        var articles = await _articleRepository.GetAllArticlesAsync(cancellationToken);
        _logger.LogInformation("[Step 3/6] Fetched {Count} article(s). Bulk indexing into '{IndexName}'...",
            articles.Count, indexName);

        if (articles.Count == 0)
        {
            _logger.LogWarning("[Step 3/6] No articles returned from data source. Proceeding with empty index.");
            return true;
        }

        var bulkResponse = await _client.BulkAsync(b => b
            .Index(indexName)
            .IndexMany(articles, (op, article) => op.Id(article.Id)), cancellationToken);

        if (bulkResponse.Errors)
        {
            var failedItems = bulkResponse.ItemsWithErrors.Select(i => new { i.Id, i.Error?.Reason }).ToList();
            _logger.LogError(
                "[Step 3/6] {ErrorCount} article(s) failed to index. Errors: {Errors}",
                failedItems.Count, JsonSerializer.Serialize(failedItems));
            return false;
        }

        _logger.LogInformation("[Step 3/6] Successfully indexed {Count} article(s) into '{IndexName}'.",
            articles.Count, indexName);
        return true;
    }

    private async Task<List<string>> GetIndicesForAliasAsync(string aliasName)
    {
        _logger.LogInformation("[Step 1/6] Retrieving current indices for alias '{Alias}'...", aliasName);

        var response = await _client.Transport.GetAsync<StringResponse>($"/_alias/{aliasName}");

        if (!response.ApiCallDetails.HasSuccessfulStatusCode)
        {
            _logger.LogInformation(
                "[Step 1/6] No existing alias '{Alias}' found (this is expected on the first run).", aliasName);
            return [];
        }

        // Response format: { "index_name": { "aliases": { "alias_name": {} } } }
        using var doc = JsonDocument.Parse(response.Body);
        var indices = doc.RootElement.EnumerateObject().Select(p => p.Name).ToList();

        _logger.LogInformation(
            "[Step 1/6] Found {Count} index(es) for alias '{Alias}': [{Indices}]",
            indices.Count, aliasName, string.Join(", ", indices));

        return indices;
    }

    private async Task<bool> UpdateAliasAsync(string aliasName, string newIndexName, List<string> oldIndices)
    {
        _logger.LogInformation(
            "[Step 4/6] Atomically updating alias '{Alias}' to point to '{NewIndex}'...",
            aliasName, newIndexName);

        var actions = new List<object>();

        // Remove alias from all old indices
        foreach (var oldIndex in oldIndices)
        {
            actions.Add(new { remove = new { index = oldIndex, alias = aliasName } });
            _logger.LogInformation("[Step 4/6]   - Removing alias from old index '{OldIndex}'", oldIndex);
        }

        // Add alias to new index
        actions.Add(new { add = new { index = newIndexName, alias = aliasName } });
        _logger.LogInformation("[Step 4/6]   - Adding alias to new index '{NewIndex}'", newIndexName);

        var requestBody = JsonSerializer.Serialize(new { actions });
        var response = await _client.Transport.PostAsync<StringResponse>(
            "/_aliases", PostData.String(requestBody));

        if (!response.ApiCallDetails.HasSuccessfulStatusCode)
        {
            _logger.LogError(
                "[Step 4/6] Failed to update alias. Status: {Status}, Response: {Body}",
                response.ApiCallDetails.HttpStatusCode, response.Body);
            return false;
        }

        _logger.LogInformation(
            "[Step 4/6] Alias '{Alias}' updated successfully to point to '{NewIndex}'.",
            aliasName, newIndexName);
        return true;
    }

    private async Task<bool> VerifyAliasAsync(string aliasName)
    {
        _logger.LogInformation("[Step 5/6] Verifying alias '{Alias}' is operational...", aliasName);

        try
        {
            // Verify the alias resolves by performing a count query against it
            var countResponse = await _client.Transport.GetAsync<StringResponse>($"/{aliasName}/_count");

            if (!countResponse.ApiCallDetails.HasSuccessfulStatusCode)
            {
                _logger.LogError(
                    "[Step 5/6] Alias verification failed. Count query returned status {Status}. Response: {Body}",
                    countResponse.ApiCallDetails.HttpStatusCode, countResponse.Body);
                return false;
            }

            // Parse count from response
            using var doc = JsonDocument.Parse(countResponse.Body);
            var count = doc.RootElement.GetProperty("count").GetInt64();

            _logger.LogInformation(
                "[Step 5/6] Alias '{Alias}' verified successfully. Document count: {Count}.",
                aliasName, count);

            // Also verify the alias mapping is correct
            var aliasResponse = await _client.Transport.GetAsync<StringResponse>($"/_alias/{aliasName}");
            if (aliasResponse.ApiCallDetails.HasSuccessfulStatusCode)
            {
                using var aliasDoc = JsonDocument.Parse(aliasResponse.Body);
                var resolvedIndices = aliasDoc.RootElement.EnumerateObject().Select(p => p.Name).ToList();
                _logger.LogInformation(
                    "[Step 5/6] Alias '{Alias}' resolves to index(es): [{Indices}]",
                    aliasName, string.Join(", ", resolvedIndices));
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Step 5/6] Exception during alias verification for '{Alias}'.", aliasName);
            return false;
        }
    }

    private async Task DeleteOldIndicesAsync(List<string> oldIndices)
    {
        if (oldIndices.Count == 0)
        {
            _logger.LogInformation("[Step 6/6] No old indices to delete.");
            return;
        }

        _logger.LogInformation(
            "[Step 6/6] Deleting {Count} old index(es): [{Indices}]...",
            oldIndices.Count, string.Join(", ", oldIndices));

        foreach (var oldIndex in oldIndices)
        {
            var response = await _client.Transport.DeleteAsync<StringResponse>($"/{oldIndex}");

            if (response.ApiCallDetails.HasSuccessfulStatusCode)
            {
                _logger.LogInformation("[Step 6/6] Deleted old index '{OldIndex}' successfully.", oldIndex);
            }
            else
            {
                _logger.LogWarning(
                    "[Step 6/6] Failed to delete old index '{OldIndex}'. Status: {Status}. Manual cleanup may be required.",
                    oldIndex, response.ApiCallDetails.HttpStatusCode);
            }
        }
    }

    private async Task DeleteIndexSafeAsync(string indexName)
    {
        try
        {
            _logger.LogInformation("Cleaning up: deleting index '{IndexName}'...", indexName);
            await _client.Transport.DeleteAsync<StringResponse>($"/{indexName}");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to clean up index '{IndexName}'.", indexName);
        }
    }
}
