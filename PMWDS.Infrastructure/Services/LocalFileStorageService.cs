using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PMWDS.Infrastructure.Settings;

namespace PMWDS.Infrastructure.Services;

public interface ILocalFileStorageService
{
    Task<string> UploadAvatarAsync(Stream stream, string userCode, string extension, CancellationToken ct = default);
    Task<string> UploadDocumentAsync(Stream stream, string projectCode, string projectName, string extension, string contentType, CancellationToken ct = default);
    Task<Stream> DownloadFileAsync(string filePath, CancellationToken ct = default);
    Task DeleteFileAsync(string filePath, CancellationToken ct = default);
}

public class LocalFileStorageService : ILocalFileStorageService
{
    private readonly LocalFileStorageSettings _settings;
    private readonly ILogger<LocalFileStorageService> _logger;

    public LocalFileStorageService(
        IOptions<LocalFileStorageSettings> settings,
        ILogger<LocalFileStorageService> logger)
    {
        _settings = settings.Value;
        _logger = logger;

        Directory.CreateDirectory(_settings.FullAvatarsPath);
        Directory.CreateDirectory(_settings.FullDocumentsPath);

        _logger.LogInformation(
            "[LocalFileStorage] Avatars: {AvatarsPath}, Documents: {DocumentsPath}",
            _settings.FullAvatarsPath,
            _settings.FullDocumentsPath);
    }

    public async Task<string> UploadAvatarAsync(
        Stream stream,
        string userCode,
        string extension,
        CancellationToken ct = default)
    {
        var guid = Guid.NewGuid().ToString("N");
        var safeExtension = SanitizeExtension(extension);
        var fileName = $"{SanitizeFolderName(userCode)}-{guid}{safeExtension}";
        var filePath = Path.Combine(_settings.FullAvatarsPath, fileName);

        await using var fileStream = File.Create(filePath);
        await stream.CopyToAsync(fileStream, ct);

        var relativePath = $"avatars/{fileName}";
        _logger.LogDebug("[LocalFileStorage] Avatar saved: {Path}", relativePath);
        return relativePath;
    }

    public async Task<string> UploadDocumentAsync(
        Stream stream,
        string projectCode,
        string projectName,
        string extension,
        string contentType,
        CancellationToken ct = default)
    {
        var projectFolder = SanitizeFolderName(projectCode);
        var projectFolderPath = Path.Combine(_settings.FullDocumentsPath, projectFolder);
        Directory.CreateDirectory(projectFolderPath);

        var sanitizedName = SanitizeFileName(projectName);
        var guid = Guid.NewGuid().ToString("N");
        var safeExtension = SanitizeExtension(extension);
        var fileName = $"{sanitizedName}-{guid}{safeExtension}";
        var filePath = Path.Combine(projectFolderPath, fileName);

        await using var fileStream = File.Create(filePath);
        await stream.CopyToAsync(fileStream, ct);

        var relativePath = $"documents/{projectFolder}/{fileName}";
        _logger.LogDebug("[LocalFileStorage] Document saved: {Path}", relativePath);
        return relativePath;
    }

    public Task<Stream> DownloadFileAsync(string filePath, CancellationToken ct = default)
    {
        var fullPath = ResolvePath(filePath);
        if (!File.Exists(fullPath))
        {
            throw new FileNotFoundException($"File not found: {filePath}");
        }

        _logger.LogDebug("[LocalFileStorage] Downloading: {Path}", fullPath);
        return Task.FromResult<Stream>(File.OpenRead(fullPath));
    }

    private string ResolvePath(string relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath))
        {
            throw new FileNotFoundException("Empty file path.");
        }

        // Normalize separators so stored paths resolve the same on Windows and Linux.
        var normalized = relativePath.Replace('\\', '/').TrimStart('/');

        var root = _settings.FullDocumentsPath;
        var prefix = "documents/";
        var isAvatar = normalized.StartsWith("avatars/", StringComparison.OrdinalIgnoreCase);
        if (isAvatar)
        {
            root = _settings.FullAvatarsPath;
            normalized = normalized["avatars/".Length..];
        }
        else if (normalized.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
        {
            normalized = normalized[prefix.Length..];
        }

        // Reject traversal instead of trusting stored values: a path like
        // "documents/../../etc/passwd" would otherwise resolve outside the storage root.
        var segments = normalized.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (segments.Length == 0 || segments.Any(s => s is "." or ".."))
        {
            throw new FileNotFoundException($"Invalid file path: {relativePath}");
        }

        var combined = Path.GetFullPath(Path.Combine(root, Path.Combine(segments)));
        var fullRoot = Path.GetFullPath(root);
        if (!combined.StartsWith(fullRoot, StringComparison.OrdinalIgnoreCase))
        {
            throw new FileNotFoundException($"Invalid file path: {relativePath}");
        }

        return combined;
    }

    /// <summary>
    /// Builds a safe single path segment. The rejected set is explicit rather than taken from
    /// <see cref="Path.GetInvalidFileNameChars"/> because that list is OS-dependent — on Linux it
    /// contains almost nothing, so characters that are dangerous on Windows (and the traversal
    /// sequences "..") would pass through and produce a path that behaves differently in
    /// development and in production.
    /// </summary>
    private static string SanitizeSegment(string name, string fallback)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return fallback;
        }

        var invalid = new HashSet<char>(Path.GetInvalidFileNameChars())
        {
            '/', '\\', ':', '*', '?', '"', '<', '>', '|',
            '\0', (char)0x7F
        };

        var cleaned = new string(name
            .Where(c => !invalid.Contains(c) && !char.IsControl(c))
            .ToArray())
            .Trim()
            .Trim('.', ' ');

        // Collapse whitespace so names remain usable on every filesystem.
        cleaned = string.Join(' ', cleaned.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));

        if (cleaned.Length == 0)
        {
            return fallback;
        }

        // Keep room for the GUID and extension appended by the callers.
        const int maxSegmentLength = 64;
        return cleaned.Length <= maxSegmentLength
            ? cleaned
            : cleaned[..maxSegmentLength].Trim().Trim('.', ' ');
    }

    private static string SanitizeFolderName(string name)
    {
        var cleaned = SanitizeSegment(name, "unknown");
        return cleaned == "." || cleaned == ".." ? "unknown" : cleaned;
    }

    private static string SanitizeFileName(string name)
    {
        var cleaned = SanitizeSegment(name, "file");
        return cleaned == "." || cleaned == ".." ? "file" : cleaned;
    }

    /// <summary>
    /// Keeps only a plain extension (".pdf") and rejects anything that could carry a separator or
    /// traversal, so the caller's FileName can never influence the directory structure.
    /// </summary>
    private static string SanitizeExtension(string extension)
    {
        if (string.IsNullOrWhiteSpace(extension))
        {
            return string.Empty;
        }

        var trimmed = extension.Trim();
        if (!trimmed.StartsWith('.'))
        {
            trimmed = "." + trimmed;
        }

        if (trimmed.Length is < 2 or > 12)
        {
            return string.Empty;
        }

        var invalid = new HashSet<char>(Path.GetInvalidFileNameChars()) { '/', '\\', '\0' };
        return trimmed.Any(c => invalid.Contains(c) || char.IsControl(c)) ? string.Empty : trimmed;
    }
}
