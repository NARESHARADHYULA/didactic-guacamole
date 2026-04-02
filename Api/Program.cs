using Api.Services;
using Elastic.Clients.Elasticsearch;
using Elastic.Transport;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

// Elasticsearch client
var cloudId = builder.Configuration["Elasticsearch:CloudId"]
    ?? throw new InvalidOperationException("Elasticsearch:CloudId is not configured.");
var apiKey = builder.Configuration["Elasticsearch:ApiKey"]
    ?? throw new InvalidOperationException("Elasticsearch:ApiKey is not configured.");
builder.Services.AddSingleton(new ElasticsearchClient(new ElasticsearchClientSettings(cloudId, new ApiKey(apiKey))));

// Article data source (replace SampleArticleRepository with a real implementation)
builder.Services.AddScoped<IArticleRepository, SampleArticleRepository>();

// Elastic reindex service
builder.Services.AddScoped<ElasticIndexingService>();

// Nightly background service
builder.Services.AddHostedService<NightlyIndexingBackgroundService>();

var app = builder.Build();

app.UseHttpsRedirection();
app.MapControllers();
app.Run();
