using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PMWDS.Domain.Entities;
using PMWDS.Domain.Enums;

namespace PMWDS.Persistence.Configurations;

public class ProjectDocumentConfiguration : IEntityTypeConfiguration<ProjectDocument>
{
    public void Configure(EntityTypeBuilder<ProjectDocument> b)
    {
        b.ToTable("ProjectDocuments");
        b.HasKey(e => e.Id);

        // The ProjectId relationship and its index are owned by ProjectConfiguration.
        // Redeclaring them here makes EF create a second shadow FK (ProjectId1).

        // Milestone / task links are contextual only. Deleting the underlying work item must
        // never take an uploaded document with it, so the link is detached instead - the same
        // rule UtilizationCertificateConfiguration applies to certificates.
        b.HasOne(e => e.Milestone)
            .WithMany()
            .HasForeignKey(e => e.MilestoneId)
            .OnDelete(DeleteBehavior.SetNull);

        b.HasOne(e => e.Task)
            .WithMany()
            .HasForeignKey(e => e.TaskId)
            .OnDelete(DeleteBehavior.SetNull);

        b.HasIndex(e => e.MilestoneId);
        b.HasIndex(e => e.TaskId);

        // Existing columns deliberately keep their original (unbounded) shape so the
        // new migration only ever adds, never narrows, an existing column.
        b.Property(e => e.Category)
            .HasConversion<string>()
            .HasMaxLength(40);

        b.HasIndex(e => e.Category);
    }
}

public class UtilizationCertificateConfiguration : IEntityTypeConfiguration<UtilizationCertificate>
{
    public void Configure(EntityTypeBuilder<UtilizationCertificate> b)
    {
        b.ToTable("UtilizationCertificates");
        b.HasKey(e => e.Id);

        b.Property(e => e.CertificateNumber).HasMaxLength(100).IsRequired();
        b.Property(e => e.FundingSource).HasMaxLength(200).IsRequired();
        b.Property(e => e.Purpose).HasMaxLength(2000);
        b.Property(e => e.ReviewNotes).HasMaxLength(2000);
        b.Property(e => e.AmountClaimed).HasColumnType("decimal(18,2)");
        b.Property(e => e.AmountUtilized).HasColumnType("decimal(18,2)");
        b.Property(e => e.Status)
            .HasConversion<string>()
            .HasMaxLength(20);

        b.HasOne<Project>()
            .WithMany()
            .HasForeignKey(e => e.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        // A certificate is always backed by the uploaded file. Cascade here keeps the
        // certificate and its document from ever drifting apart.
        b.HasOne(e => e.Document)
            .WithOne()
            .HasForeignKey<UtilizationCertificate>(e => e.DocumentId)
            .OnDelete(DeleteBehavior.Cascade);

        // Milestone / task links are informational: deleting the underlying work item
        // must not destroy an already approved financial certificate.
        b.HasOne(e => e.Milestone)
            .WithMany()
            .HasForeignKey(e => e.MilestoneId)
            .OnDelete(DeleteBehavior.SetNull);

        b.HasOne(e => e.Task)
            .WithMany()
            .HasForeignKey(e => e.TaskId)
            .OnDelete(DeleteBehavior.SetNull);

        b.HasIndex(e => e.ProjectId);
        b.HasIndex(e => e.DocumentId).IsUnique();
        b.HasIndex(e => e.Status);
        b.HasIndex(e => e.CertificateNumber);
    }
}