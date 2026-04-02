using Api.Models;

namespace Api.Services;

/// <summary>
/// Sample article repository that returns hardcoded data.
/// Replace this with a real data source (database, external API, etc.) in production.
/// </summary>
public class SampleArticleRepository : IArticleRepository
{
    public Task<List<Article>> GetAllArticlesAsync(CancellationToken cancellationToken = default)
    {
        var articles = new List<Article>
        {
            new()
            {
                Id = "1",
                Title = "Getting Started with Elasticsearch",
                Summary = "Learn the basics of Elasticsearch and how to set up your first cluster.",
                Body = "Elasticsearch is a distributed, RESTful search and analytics engine capable of solving a growing number of use cases.",
                Author = "John Doe",
                Tags = ["elasticsearch", "search", "tutorial"],
                PublishedAt = DateTime.UtcNow,
                Url = "https://example.com/articles/getting-started-elasticsearch"
            },
            new()
            {
                Id = "2",
                Title = "Advanced Elasticsearch Queries",
                Summary = "Deep dive into Elasticsearch query DSL and advanced search techniques.",
                Body = "The Query DSL in Elasticsearch is a powerful way to express complex queries using a JSON-based syntax.",
                Author = "Jane Smith",
                Tags = ["elasticsearch", "queries", "advanced"],
                PublishedAt = DateTime.UtcNow,
                Url = "https://example.com/articles/advanced-elasticsearch-queries"
            },
            new()
            {
                Id = "3",
                Title = "Elasticsearch Index Management Best Practices",
                Summary = "Learn how to manage indices effectively using aliases and lifecycle policies.",
                Body = "Proper index management is crucial for maintaining a healthy Elasticsearch cluster.",
                Author = "Bob Wilson",
                Tags = ["elasticsearch", "index-management", "best-practices"],
                PublishedAt = DateTime.UtcNow,
                Url = "https://example.com/articles/elasticsearch-index-management"
            }
        };

        return Task.FromResult(articles);
    }
}
