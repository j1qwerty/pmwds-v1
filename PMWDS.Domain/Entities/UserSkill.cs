using PMWDS.Domain.Common;
namespace PMWDS.Domain.Entities;

public class UserSkill : BaseEntity
{
    public Guid UserId { get; private set; }
    public Guid SkillId { get; private set; }
    public int ProficiencyLevel { get; private set; } // 1–5
    public int ExperienceMonths { get; private set; }
    public DateTime LastUsed { get; private set; }
    public double AIConfidenceScore { get; private set; }
    public ApplicationUser? User { get; private set; }
    public Skill? Skill { get; private set; }
    protected UserSkill() { }
    public static UserSkill Create(
    Guid userId, Guid skillId,
    int proficiencyLevel, int experienceMonths)
    {
        return new UserSkill
        {
            UserId = userId,
            SkillId = skillId,
            ProficiencyLevel = Math.Clamp(proficiencyLevel, 1, 5),
            ExperienceMonths = experienceMonths,
            LastUsed = DateTime.UtcNow
        };
    }
    public void UpdateProficiency(int newLevel)
    {
        ProficiencyLevel = Math.Clamp(newLevel, 1, 5);
        LastUsed = DateTime.UtcNow;
    }
    public void IncrementExperience(int months)
    {
        ExperienceMonths += months;
        LastUsed = DateTime.UtcNow;
    }

     public void UpdateExperience(int months)
    {
        ExperienceMonths = months;
        LastUsed = DateTime.UtcNow;
    }
    public void SetAIConfidenceScore(double score)
    => AIConfidenceScore = Math.Clamp(score, 0, 1);
}
