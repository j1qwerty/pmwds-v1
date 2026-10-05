using PMWDS.Application.DTOs.Reports;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace PMWDS.Infrastructure.Services;

public interface IReportPdfRenderer
{
    byte[] Render(AiReportResponse report);
}

public class ReportPdfRenderer : IReportPdfRenderer
{
    public byte[] Render(AiReportResponse report)
    {
        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(50);
                page.DefaultTextStyle(x => x.FontSize(10).FontFamily("Arial"));

                page.Header().Element(h => ComposeHeader(h, report));
                page.Content().Element(c => ComposeContent(c, report));
                page.Footer().Element(f => ComposeFooter(f, report));
            });
        }).GeneratePdf();
    }

    private static void ComposeHeader(IContainer container, AiReportResponse report)
    {
        container.Column(col =>
        {
            col.Item().Row(row =>
            {
                row.AutoItem().Column(c =>
                {
                    c.Item().Text(report.Title)
                        .FontSize(20).Bold().FontColor(Colors.Blue.Darken3);
                    c.Item().Text($"Generated: {report.GeneratedAt:yyyy-MM-dd HH:mm} UTC")
                        .FontSize(9).FontColor(Colors.Grey.Medium);
                });
            });

            col.Item().PaddingTop(8).LineHorizontal(1).LineColor(Colors.Blue.Darken2);
            col.Item().PaddingVertical(8).Text(report.Summary)
                .FontSize(10).FontColor(Colors.Grey.Darken3).Italic();
        });
    }

    private static void ComposeContent(IContainer container, AiReportResponse report)
    {
        container.Column(col =>
        {
            if (report.Metrics.Count > 0)
            {
                col.Item().PaddingBottom(8).Text("Key Metrics").FontSize(14).Bold();
                col.Item().Table(table =>
                {
                    table.ColumnsDefinition(c =>
                    {
                        foreach (var _ in report.Metrics)
                            c.RelativeColumn();
                    });

                    foreach (var metric in report.Metrics)
                    {
                        table.Cell().Padding(4).Border(1).BorderColor(Colors.Grey.Lighten2)
                            .Padding(8).Column(cellCol =>
                            {
                                cellCol.Item().Text(metric.Label).FontSize(8).FontColor(Colors.Grey.Medium);
                                cellCol.Item().Text(metric.Value).FontSize(16).Bold().FontColor(
                                    metric.Trend == "up" ? Colors.Green.Medium :
                                    metric.Trend == "down" ? Colors.Red.Medium :
                                    Colors.Blue.Medium);
                            });
                    }
                });
            }

            foreach (var section in report.Sections)
            {
                col.Item().PaddingTop(12);
                col.Item().Text(section.Title).FontSize(13).Bold();
                col.Item().PaddingTop(4).Text(section.Content).FontSize(10);
            }

            foreach (var table in report.Tables)
            {
                col.Item().PaddingTop(12);
                col.Item().Text(table.Title).FontSize(13).Bold();
                col.Item().PaddingTop(4).Table(tbl =>
                {
                    tbl.ColumnsDefinition(c =>
                    {
                        foreach (var _ in table.Columns)
                            c.RelativeColumn();
                    });

                    foreach (var colHeader in table.Columns)
                    {
                        tbl.Cell().Background(Colors.Blue.Darken3).Padding(6)
                            .Text(colHeader).FontSize(9).Bold().FontColor(Colors.White);
                    }

                    var alt = false;
                    foreach (var row in table.Rows)
                    {
                        foreach (var cell in row)
                        {
                            tbl.Cell().Background(alt ? Colors.Grey.Lighten4 : Colors.White)
                                .Padding(5).Text(cell).FontSize(9);
                        }
                        alt = !alt;
                    }
                });
            }

            if (report.Insights.Count > 0)
            {
                col.Item().PaddingTop(12);
                col.Item().Text("Key Insights").FontSize(13).Bold();
                foreach (var insight in report.Insights)
                {
                    col.Item().PaddingTop(4).Row(r =>
                    {
                        r.AutoItem().Text("  •  ").FontSize(10).FontColor(Colors.Blue.Medium);
                        r.RelativeItem().Text(insight).FontSize(10);
                    });
                }
            }

            if (report.Recommendations.Count > 0)
            {
                col.Item().PaddingTop(12);
                col.Item().Text("Recommendations").FontSize(13).Bold();
                foreach (var rec in report.Recommendations)
                {
                    col.Item().PaddingTop(4).Row(r =>
                    {
                        r.AutoItem().Text("  ›  ").FontSize(10).FontColor(Colors.Orange.Medium);
                        r.RelativeItem().Text(rec).FontSize(10);
                    });
                }
            }
        });
    }

    private static void ComposeFooter(IContainer container, AiReportResponse report)
    {
        container.Row(row =>
        {
            row.RelativeItem().AlignLeft().Text(report.Title)
                .FontSize(8).FontColor(Colors.Grey.Medium);
            row.RelativeItem().AlignRight().Text(x =>
            {
                x.Span("Page ").FontSize(8).FontColor(Colors.Grey.Medium);
                x.CurrentPageNumber().FontSize(8).FontColor(Colors.Grey.Medium);
                x.Span(" of ").FontSize(8).FontColor(Colors.Grey.Medium);
                x.TotalPages().FontSize(8).FontColor(Colors.Grey.Medium);
            });
        });
    }
}
