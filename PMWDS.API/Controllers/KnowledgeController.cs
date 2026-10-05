using PMWDS.Application.DTOs.Controllers;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Domain.Entities;

namespace PMWDS.API.Controllers;

public class KnowledgeController : BaseApiController
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUserService _currentUser;

    public KnowledgeController(IMediator mediator, IUnitOfWork uow, ICurrentUserService currentUser) : base(mediator)
    {
        _uow = uow;
        _currentUser = currentUser;
    }

    [HttpGet("articles")]
    public async Task<IActionResult> GetArticles([FromQuery] Guid? projectId, CancellationToken ct)
    {
        var articles = projectId.HasValue
            ? await _uow.KnowledgeArticles.FindAsync(a => a.ProjectId == projectId, ct)
            : await _uow.KnowledgeArticles.GetAllAsync(ct);
        return Ok(articles.OrderByDescending(a => a.LastUpdated).Select(MapArticle));
    }

    [HttpGet("articles/{id:guid}")]
    public async Task<IActionResult> GetArticle(Guid id, CancellationToken ct)
    {
        var article = await _uow.KnowledgeArticles.GetByIdAsync(id, ct);
        if (article == null)
        {
            return NotFound();
        }

        article.IncrementViewCount();
        await _uow.KnowledgeArticles.UpdateAsync(article, ct);
        await _uow.SaveChangesAsync(ct);
        return Ok(MapArticle(article));
    }

    [HttpPost("articles")]
    public async Task<IActionResult> CreateArticle([FromBody] UpsertKnowledgeArticleRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(_currentUser.UserId, out var userId))
        {
            return Unauthorized();
        }

        var article = KnowledgeArticle.Create(req.ProjectId, req.Title, req.Content, req.Category, req.Tags, userId, req.RelevanceScore);
        article.SetCreatedBy(_currentUser.UserId ?? "system");
        await _uow.KnowledgeArticles.AddAsync(article, ct);
        await _uow.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetArticle), new { id = article.Id }, MapArticle(article));
    }

    [HttpPut("articles/{id:guid}")]
    public async Task<IActionResult> UpdateArticle(Guid id, [FromBody] UpsertKnowledgeArticleRequest req, CancellationToken ct)
    {
        var article = await _uow.KnowledgeArticles.GetByIdAsync(id, ct);
        if (article == null)
        {
            return NotFound();
        }

        article.Update(req.Title, req.Content, req.Category, req.Tags, req.RelevanceScore);
        await _uow.KnowledgeArticles.UpdateAsync(article, ct);
        await _uow.SaveChangesAsync(ct);
        return Ok(MapArticle(article));
    }

    [HttpDelete("articles/{id:guid}")]
    public async Task<IActionResult> DeleteArticle(Guid id, CancellationToken ct)
    {
        await _uow.KnowledgeArticles.DeleteAsync(id, ct);
        await _uow.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("lessons")]
    public async Task<IActionResult> GetLessons([FromQuery] Guid? projectId, CancellationToken ct)
    {
        var lessons = projectId.HasValue
            ? await _uow.LessonsLearned.FindAsync(l => l.ProjectId == projectId, ct)
            : await _uow.LessonsLearned.GetAllAsync(ct);
        return Ok(lessons.OrderByDescending(l => l.RecordedDate).Select(MapLesson));
    }

    [HttpPost("lessons")]
    [Authorize(Policy = AuthorizationPolicies.Manager)]
    public async Task<IActionResult> CreateLesson([FromBody] UpsertLessonLearnedRequest req, CancellationToken ct)
    {
        var lesson = LessonLearned.Create(req.ProjectId, req.Title, req.Description, req.Category, req.Impact, req.Keywords);
        lesson.SetCreatedBy(_currentUser.UserId ?? "system");
        await _uow.LessonsLearned.AddAsync(lesson, ct);
        await _uow.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetLessons), new { id = lesson.Id }, MapLesson(lesson));
    }

    [HttpPut("lessons/{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.Manager)]
    public async Task<IActionResult> UpdateLesson(Guid id, [FromBody] UpsertLessonLearnedRequest req, CancellationToken ct)
    {
        var lesson = await _uow.LessonsLearned.GetByIdAsync(id, ct);
        if (lesson == null)
        {
            return NotFound();
        }

        lesson.Update(req.Title, req.Description, req.Category, req.Impact, req.Keywords);
        await _uow.LessonsLearned.UpdateAsync(lesson, ct);
        await _uow.SaveChangesAsync(ct);
        return Ok(MapLesson(lesson));
    }

    [HttpDelete("lessons/{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.Manager)]
    public async Task<IActionResult> DeleteLesson(Guid id, CancellationToken ct)
    {
        await _uow.LessonsLearned.DeleteAsync(id, ct);
        await _uow.SaveChangesAsync(ct);
        return NoContent();
    }

    private static KnowledgeArticleResponse MapArticle(KnowledgeArticle article)
        => new(
            article.Id,
            article.ProjectId,
            article.Title,
            article.Content,
            article.Category,
            JsonSerializer.Deserialize<List<string>>(article.TagsJson) ?? new(),
            article.AuthorId,
            article.CreatedDate,
            article.LastUpdated,
            article.ViewCount,
            article.RelevanceScore);

    private static LessonLearnedResponse MapLesson(LessonLearned lesson)
        => new(
            lesson.Id,
            lesson.ProjectId,
            lesson.Title,
            lesson.Description,
            lesson.Category,
            lesson.Impact,
            JsonSerializer.Deserialize<List<string>>(lesson.KeywordsJson) ?? new(),
            lesson.RecordedDate);
}
