namespace Api.Models;

public class Article
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string Author { get; set; } = string.Empty;
    public List<string> Tags { get; set; } = [];
    public DateTime PublishedAt { get; set; }
    public string Url { get; set; } = string.Empty;
}
