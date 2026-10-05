namespace PMWDS.API.Services;

public static class EnvFileLoader
{
    public static void Load(string contentRootPath)
    {
        foreach (var path in GetCandidatePaths(contentRootPath))
        {
            if (!File.Exists(path))
            {
                continue;
            }

            foreach (var rawLine in File.ReadAllLines(path))
            {
                var line = rawLine.Trim();
                if (line.Length == 0 || line.StartsWith('#'))
                {
                    continue;
                }

                var separatorIndex = line.IndexOf('=');
                if (separatorIndex <= 0)
                {
                    continue;
                }

                var key = line[..separatorIndex].Trim();
                var value = line[(separatorIndex + 1)..].Trim().Trim('"');
                if (!string.IsNullOrWhiteSpace(key) && string.IsNullOrEmpty(Environment.GetEnvironmentVariable(key)))
                {
                    Environment.SetEnvironmentVariable(key, value);
                }
            }
        }
    }

    private static IEnumerable<string> GetCandidatePaths(string contentRootPath)
    {
        yield return Path.Combine(contentRootPath, ".env");
        var parent = Directory.GetParent(contentRootPath)?.FullName;
        if (!string.IsNullOrWhiteSpace(parent))
        {
            yield return Path.Combine(parent, ".env");
        }
    }
}
