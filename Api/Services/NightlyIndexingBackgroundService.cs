namespace Api.Services;

/// <summary>
/// Background service that triggers an Elasticsearch reindex on a nightly schedule.
/// The scheduled time is configurable via Elasticsearch:NightlyRunTime in appsettings.json (default: 00:00 UTC).
/// </summary>
public class NightlyIndexingBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<NightlyIndexingBackgroundService> _logger;
    private readonly TimeSpan _scheduledTime;

    public NightlyIndexingBackgroundService(
        IServiceProvider serviceProvider,
        ILogger<NightlyIndexingBackgroundService> logger,
        IConfiguration config)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;

        var timeStr = config["Elasticsearch:NightlyRunTime"] ?? "00:00";
        if (!TimeSpan.TryParse(timeStr, out _scheduledTime))
        {
            _logger.LogWarning(
                "Invalid NightlyRunTime '{TimeStr}'. Defaulting to 00:00 UTC.", timeStr);
            _scheduledTime = TimeSpan.Zero;
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "Nightly indexing background service started. Scheduled run time: {Time} UTC.",
            _scheduledTime);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var delay = CalculateDelayUntilNextRun();
                _logger.LogInformation(
                    "Next nightly reindex scheduled at {NextRun} UTC (waiting {Delay}).",
                    DateTime.UtcNow.Add(delay), delay);

                await Task.Delay(delay, stoppingToken);

                _logger.LogInformation(
                    "Nightly reindex triggered at {Time} UTC.", DateTime.UtcNow);

                await ExecuteReindexAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                _logger.LogInformation("Nightly indexing background service is stopping.");
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Unhandled exception in nightly indexing background service. Will retry at next scheduled time.");
            }
        }
    }

    private TimeSpan CalculateDelayUntilNextRun()
    {
        var now = DateTime.UtcNow;
        var nextRun = now.Date.Add(_scheduledTime);

        if (nextRun <= now)
            nextRun = nextRun.AddDays(1);

        return nextRun - now;
    }

    private async Task ExecuteReindexAsync(CancellationToken stoppingToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var indexingService = scope.ServiceProvider.GetRequiredService<ElasticIndexingService>();

        var success = await indexingService.RunReindexAsync(stoppingToken);

        if (success)
            _logger.LogInformation("Nightly reindex completed successfully.");
        else
            _logger.LogError("Nightly reindex completed with errors. Check previous log entries for details.");
    }
}
