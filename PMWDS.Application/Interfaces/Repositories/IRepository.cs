using System.Linq.Expressions;
namespace PMWDS.Application.Interfaces.Repositories;

public interface IRepository<T> where T : class
{
    Task<T?> GetByIdAsync(Guid id,
    CancellationToken ct = default);
    Task<IEnumerable<T>> GetAllAsync(
    CancellationToken ct = default);
    Task<IEnumerable<T>> FindAsync(
    Expression<Func<T, bool>> predicate,
    CancellationToken ct = default);
    Task<T> AddAsync(T entity,
    CancellationToken ct = default);
    Task UpdateAsync(T entity,
    CancellationToken ct = default);
    Task DeleteAsync(Guid id,
    CancellationToken ct = default);
    Task<bool> ExistsAsync(Guid id,
    CancellationToken ct = default);
    Task<int> CountAsync(
    Expression<Func<T, bool>>? predicate = null,
    CancellationToken ct = default);
}
