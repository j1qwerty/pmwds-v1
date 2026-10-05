namespace PMWDS.Application.DTOs.Common;

public sealed record PaginationQuery(int Page = 1, int PageSize = 10)
{
    private static readonly HashSet<int> StandardPageSizes = new() { 10, 20, 30, 50, 100 };

    public int NormalizedPage => Math.Max(1, Page);

    public int NormalizedPageSize
    {
        get
        {
            var requested = PageSize <= 0 ? 10 : PageSize;
            return StandardPageSizes.Contains(requested)
                ? requested
                : Math.Clamp(requested, 1, 500);
        }
    }

    public int Skip => (NormalizedPage - 1) * NormalizedPageSize;
}

public sealed record PaginatedResponse<T>(
    IReadOnlyCollection<T> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages)
{
    public static PaginatedResponse<T> Create(
        IReadOnlyCollection<T> items,
        PaginationQuery query,
        int totalCount)
    {
        var pageSize = query.NormalizedPageSize;
        return new PaginatedResponse<T>(
            items,
            query.NormalizedPage,
            pageSize,
            totalCount,
            pageSize == 0 ? 0 : (int)Math.Ceiling(totalCount / (double)pageSize));
    }
}
