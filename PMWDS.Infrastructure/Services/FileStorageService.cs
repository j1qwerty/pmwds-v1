using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PMWDS.Infrastructure.Settings;
namespace PMWDS.Infrastructure.Services;

public interface IFileStorageService
{
    Task<string> UploadAsync(Stream stream, string fileName,
 string contentType, CancellationToken ct = default);
    Task<Stream> DownloadAsync(string filePath,
 CancellationToken ct = default);
    Task DeleteAsync(string filePath,
 CancellationToken ct = default);
    Task<string> GetPublicUrlAsync(string filePath,
 CancellationToken ct = default);
}
public class AzureBlobStorageService : IFileStorageService
{
    private readonly BlobServiceClient? _client;
    private readonly string _containerName;
    private readonly string _basePath;
    private readonly string _baseUrl;
    private readonly ILogger<AzureBlobStorageService> _logger;
    private readonly bool _azureAvailable;
    public AzureBlobStorageService(
    IOptions<AzureStorageSettings> settings,
    ILogger<AzureBlobStorageService> logger)
    {
        _logger = logger;
        var connStr = settings.Value.ConnectionString ?? string.Empty;
        _containerName = settings.Value.ContainerName ?? "pmwds-files";

        if (!string.IsNullOrWhiteSpace(connStr)
            && !connStr.Contains("UseDevelopmentStorage", StringComparison.OrdinalIgnoreCase)
            && !connStr.Contains("UseLocal", StringComparison.OrdinalIgnoreCase))
        {
            _client = new BlobServiceClient(connStr);
            _azureAvailable = true;
            _basePath = StoragePathResolver.Resolve(settings.Value.LocalUploadPath, AppContext.BaseDirectory);
            Directory.CreateDirectory(_basePath);
            _baseUrl = settings.Value.LocalBaseUrl ?? "/files";
            _logger.LogInformation(
                "[FileStorage] Azure Blob Storage enabled. Container: {Container}",
                _containerName);
        }
        else
        {
            _azureAvailable = false;
            _basePath = StoragePathResolver.Resolve(settings.Value.LocalUploadPath, AppContext.BaseDirectory);
            Directory.CreateDirectory(_basePath);
            _baseUrl = settings.Value.LocalBaseUrl ?? "/files";
            _logger.LogInformation(
                "[FileStorage] Azure not configured. Using local fallback at: {Path}",
                _basePath);
        }
    }
    public async Task<string> UploadAsync(
    Stream stream, string fileName,
    string contentType,
    CancellationToken ct = default)
    {
        if (_azureAvailable && _client != null)
        {
            try
            {
                var container = _client.GetBlobContainerClient(_containerName);
                await container.CreateIfNotExistsAsync(cancellationToken: ct);
                var blobName = $"{Guid.NewGuid()}/{fileName}";
                var blobClient = container.GetBlobClient(blobName);
                stream.Position = 0;
                await blobClient.UploadAsync(stream,
                    new BlobHttpHeaders { ContentType = contentType },
                    cancellationToken: ct);
                _logger.LogDebug(
                    "[FileStorage] Uploaded to Azure: {Blob}", blobName);
                return blobClient.Uri.ToString();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "[FileStorage] Azure upload failed, falling back to local. Error: {Error}",
                    ex.Message);
            }
        }
        return await UploadLocalAsync(stream, fileName, ct);
    }
    public async Task<Stream> DownloadAsync(
    string filePath,
    CancellationToken ct = default)
    {
        if (_azureAvailable && _client != null)
        {
            try
            {
                var container = _client.GetBlobContainerClient(_containerName);
                var blobClient = container.GetBlobClient(filePath);
                var response = await blobClient.DownloadAsync(ct);
                _logger.LogDebug(
                    "[FileStorage] Downloaded from Azure: {Path}", filePath);
                return response.Value.Content;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "[FileStorage] Azure download failed, falling back to local. Error: {Error}",
                    ex.Message);
            }
        }
        var localPath = ResolveLocalPath(filePath);
        if (!File.Exists(localPath))
        {
            throw new FileNotFoundException(
                $"File not found: {filePath}");
        }
        _logger.LogDebug(
            "[FileStorage] Downloaded from local: {Path}", localPath);
        return File.OpenRead(localPath);
    }
    public async Task DeleteAsync(
    string filePath,
    CancellationToken ct = default)
    {
        bool azureDeleted = false;
        if (_azureAvailable && _client != null)
        {
            try
            {
                var container = _client.GetBlobContainerClient(_containerName);
                var blobClient = container.GetBlobClient(filePath);
                await blobClient.DeleteIfExistsAsync(cancellationToken: ct);
                azureDeleted = true;
                _logger.LogDebug(
                    "[FileStorage] Deleted from Azure: {Path}", filePath);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "[FileStorage] Azure delete failed, falling back to local. Error: {Error}",
                    ex.Message);
            }
        }
        if (!azureDeleted)
        {
            var localPath = ResolveLocalPath(filePath);
            if (File.Exists(localPath))
            {
                File.Delete(localPath);
                _logger.LogDebug(
                    "[FileStorage] Deleted from local: {Path}", localPath);
            }
        }
    }
    public Task<string> GetPublicUrlAsync(
    string filePath,
    CancellationToken ct = default)
    {
        if (_azureAvailable && _client != null)
        {
            var container = _client.GetBlobContainerClient(_containerName);
            var blobClient = container.GetBlobClient(filePath);
            return Task.FromResult(blobClient.Uri.ToString());
        }
        var localPath = ResolveLocalPath(filePath);
        return Task.FromResult(localPath);
    }
    private async Task<string> UploadLocalAsync(
    Stream stream, string fileName,
    CancellationToken ct)
    {
        var id = Guid.NewGuid().ToString();
        var ext = Path.GetExtension(fileName);
        var localName = $"{id}{ext}";
        var folderPath = Path.Combine(_basePath, id[..4]);
        Directory.CreateDirectory(folderPath);
        var localPath = Path.Combine(folderPath, localName);
        await using var fileStream = File.Create(localPath);
        await stream.CopyToAsync(fileStream, ct);
        var url = $"{_baseUrl}/{_containerName}/{id[..4]}/{localName}";
        _logger.LogDebug(
            "[FileStorage] Saved locally: {Path}", localPath);
        return url;
    }
    private string ResolveLocalPath(string filePath)
    {
        if (filePath.StartsWith(_baseUrl, StringComparison.OrdinalIgnoreCase))
        {
            var relativePath = filePath.Substring(_baseUrl.Length).TrimStart('/', '\\');
            if (relativePath.StartsWith(_containerName + "/", StringComparison.OrdinalIgnoreCase)
                || relativePath.StartsWith(_containerName + "\\", StringComparison.OrdinalIgnoreCase))
            {
                relativePath = relativePath.Substring(_containerName.Length + 1);
            }
            return Path.Combine(_basePath, relativePath.Replace('/', Path.DirectorySeparatorChar));
        }
        if (Uri.TryCreate(filePath, UriKind.Absolute, out _))
        {
            return filePath;
        }
        return Path.Combine(_basePath, filePath);
    }
}

