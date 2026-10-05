using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PMWDS.Domain.Entities;

namespace PMWDS.Persistence.Configurations;

public class AlertRuleConfiguration : IEntityTypeConfiguration<AlertRule>
{
    public void Configure(EntityTypeBuilder<AlertRule> b)
    {
        b.ToTable("AlertRules");
        b.HasKey(e => e.Id);
        b.Property(e => e.Name).HasMaxLength(200).IsRequired();
        b.Property(e => e.ConditionType).HasMaxLength(100).IsRequired();
        b.Property(e => e.ActionType).HasMaxLength(100).IsRequired();
        b.Property(e => e.ConditionExpression).HasMaxLength(2000).IsRequired();
    }
}
