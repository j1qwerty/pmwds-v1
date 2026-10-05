namespace PMWDS.Infrastructure.Settings;

/// <summary>
/// Resolves configured storage paths into absolute directories.
/// </summary>
/// <remarks>
/// Two rules that must hold everywhere:
/// 1. <see cref="Microsoft.Extensions.FileProviders.PhysicalFileProvider"/> throws
///    "The path must be absolute" on relative roots.
/// 2. A relative path must bind to the application base directory, never the process working
///    directory. Under systemd those differ (<c>/var/www/&lt;domain&gt;/app</c>), so a relative
///    path would silently write to the wrong place and, worse, land inside the publish folder
///    where a redeploy deletes it.
/// </remarks>
public static class StoragePathResolver
{
    /// <summary>
    /// Returns an absolute directory path. Relative values resolve against
    /// <paramref name="basePath"/>; empty values fall back to <paramref name="defaultDirectory"/>
    /// under that same base.
    /// </summary>
    public static string Resolve(string? configuredPath, string basePath, string defaultDirectory = "Data")
    {
        var candidate = string.IsNullOrWhiteSpace(configuredPath)
            ? Path.Combine(basePath, defaultDirectory)
            : configuredPath.Trim();

        return Path.IsPathRooted(candidate)
            ? Path.GetFullPath(candidate)
            : Path.GetFullPath(Path.Combine(basePath, candidate));
    }
}