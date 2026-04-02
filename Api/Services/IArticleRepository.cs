using Api.Models;

namespace Api.Services;

public interface IArticleRepository
{
    Task<List<Article>> GetAllArticlesAsync(CancellationToken cancellationToken = default);
}
