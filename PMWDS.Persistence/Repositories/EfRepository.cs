using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using PMWDS.Application.Interfaces.Repositories;
using PMWDS.Domain.Common;
using PMWDS.Persistence.Context;
namespace PMWDS.Persistence.Repositories;

public class EfRepository<T>
 : IRepository<T> where T : class
{
    protected readonly ApplicationDbContext _context;
    protected readonly DbSet<T> _dbSet;
    public EfRepository(ApplicationDbContext context)
    {
        _context = context;
        _dbSet = context.Set<T>();
    }
    public virtual async Task<T?> GetByIdAsync(
    Guid id, CancellationToken ct = default)
    => await _dbSet.FindAsync(
    new object[] { id }, ct);
    public virtual async Task<IEnumerable<T>> GetAllAsync(
    CancellationToken ct = default)
    => await _dbSet.ToListAsync(ct);
    public virtual async Task<IEnumerable<T>> FindAsync(
    Expression<Func<T, bool>> predicate,
    CancellationToken ct = default)
    => await _dbSet.Where(predicate).ToListAsync(ct);
    public virtual async Task<T> AddAsync(
    T entity, CancellationToken ct = default)
    {
        await _dbSet.AddAsync(entity, ct);
        return entity;
    }
    public virtual Task UpdateAsync(
    T entity, CancellationToken ct = default)
    {
        _context.Entry(entity).State = EntityState.Modified;
        return Task.CompletedTask;
    }
    public virtual async Task DeleteAsync(
    Guid id, CancellationToken ct = default)
    {
        var entity = await GetByIdAsync(id, ct);
        if (entity is null)
        {
            return;
        }

        if (entity is BaseEntity softDeleteEntity)
        {
            softDeleteEntity.SoftDelete("system");
            _context.Entry(entity).State = EntityState.Modified;
            return;
        }

        _dbSet.Remove(entity);
    }
    public virtual async Task<bool> ExistsAsync(
    Guid id, CancellationToken ct = default)
    => await _dbSet.FindAsync(
    new object[] { id }, ct) is not null;
    public virtual async Task<int> CountAsync(
    Expression<Func<T, bool>>? predicate = null,
    CancellationToken ct = default)
    => predicate is null
    ? await _dbSet.CountAsync(ct)
    : await _dbSet.CountAsync(predicate, ct);
}
