using Elastic.Clients.Elasticsearch;
using Elastic.Transport;
using Microsoft.AspNetCore.Mvc;
using Api.Models;

namespace Api.Controllers;

[ApiController]
[Route("api/elastic")]
public class ElasticController(ElasticsearchClient elastic, IConfiguration config, IWebHostEnvironment env) : ControllerBase
{
    private string IndexName => config["Elasticsearch:IndexName"] ?? "articles";

    [HttpPost("create-index")]
    public async Task<IActionResult> CreateIndex()
    {
        var schemaPath = Path.Combine(env.ContentRootPath, "elastic-index.json");

        if (!System.IO.File.Exists(schemaPath))
            return StatusCode(500, new { message = "Index schema file 'elastic-index.json' not found." });

        var schemaJson = await System.IO.File.ReadAllTextAsync(schemaPath);

        var existsResponse = await elastic.Indices.ExistsAsync(IndexName);
        if (existsResponse.Exists)
            return Conflict(new { message = $"Index '{IndexName}' already exists." });

        var createResponse = await elastic.Transport.PutAsync<StringResponse>(
            $"/{IndexName}", PostData.String(schemaJson));

        if (!createResponse.ApiCallDetails.HasSuccessfulStatusCode)
            return StatusCode(500, new { message = "Failed to create index.", detail = createResponse.Body });

        return Ok(new { message = $"Index '{IndexName}' created successfully." });
    }

    [HttpPost("index-articles")]
    public async Task<IActionResult> IndexArticles([FromBody] List<Article> articles)
    {
        if (articles is null || articles.Count == 0)
            return BadRequest(new { message = "No articles provided." });

        var bulkResponse = await elastic.BulkAsync(b => b
            .Index(IndexName)
            .IndexMany(articles, (op, article) => op.Id(article.Id)));

        if (bulkResponse.Errors)
        {
            var errors = bulkResponse.ItemsWithErrors
                .Select(i => new { i.Id, i.Error?.Reason })
                .ToList();
            return StatusCode(500, new { message = "Some articles failed to index.", errors });
        }

        return Ok(new { message = $"{articles.Count} article(s) indexed successfully." });
    }
}
