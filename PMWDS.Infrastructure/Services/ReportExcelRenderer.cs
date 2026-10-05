using ClosedXML.Excel;
using PMWDS.Application.DTOs.Reports;

namespace PMWDS.Infrastructure.Services;

public interface IReportExcelRenderer
{
    byte[] Render(AiReportResponse report);
}

public class ReportExcelRenderer : IReportExcelRenderer
{
    public byte[] Render(AiReportResponse report)
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.Worksheets.Add(report.Title.Length > 31 ? report.Title[..31] : report.Title);

        sheet.Cell(1, 1).Value = report.Title;
        sheet.Cell(1, 1).Style.Font.Bold = true;
        sheet.Cell(1, 1).Style.Font.FontSize = 16;
        sheet.Range(1, 1, 1, 4).Merge();

        sheet.Cell(2, 1).Value = $"Generated: {report.GeneratedAt:yyyy-MM-dd HH:mm} UTC";
        sheet.Cell(2, 1).Style.Font.FontSize = 9;
        sheet.Cell(2, 1).Style.Font.FontColor = XLColor.Gray;

        sheet.Cell(3, 1).Value = report.Summary;
        sheet.Cell(3, 1).Style.Font.Italic = true;
        sheet.Range(3, 1, 3, 4).Merge();

        var row = 5;

        if (report.Metrics.Count > 0)
        {
            sheet.Cell(row, 1).Value = "Key Metrics";
            sheet.Cell(row, 1).Style.Font.Bold = true;
            sheet.Cell(row, 1).Style.Font.FontSize = 13;
            row++;

            var metricCol = 1;
            foreach (var metric in report.Metrics)
            {
                sheet.Cell(row, metricCol).Value = metric.Label;
                sheet.Cell(row, metricCol).Style.Font.FontSize = 9;
                sheet.Cell(row, metricCol).Style.Font.FontColor = XLColor.Gray;
                sheet.Cell(row + 1, metricCol).Value = metric.Value;
                sheet.Cell(row + 1, metricCol).Style.Font.FontSize = 14;
                sheet.Cell(row + 1, metricCol).Style.Font.Bold = true;
                metricCol++;
            }
            row += 3;
        }

        foreach (var section in report.Sections)
        {
            sheet.Cell(row, 1).Value = section.Title;
            sheet.Cell(row, 1).Style.Font.Bold = true;
            sheet.Cell(row, 1).Style.Font.FontSize = 12;
            row++;
            sheet.Cell(row, 1).Value = section.Content;
            sheet.Cell(row, 1).Style.Font.FontSize = 10;
            sheet.Range(row, 1, row, 4).Merge();
            row += 2;
        }

        foreach (var table in report.Tables)
        {
            sheet.Cell(row, 1).Value = table.Title;
            sheet.Cell(row, 1).Style.Font.Bold = true;
            sheet.Cell(row, 1).Style.Font.FontSize = 12;
            row++;

            for (var c = 0; c < table.Columns.Count; c++)
            {
                sheet.Cell(row, c + 1).Value = table.Columns[c];
                sheet.Cell(row, c + 1).Style.Font.Bold = true;
                sheet.Cell(row, c + 1).Style.Fill.BackgroundColor = XLColor.BlueGray;
                sheet.Cell(row, c + 1).Style.Font.FontColor = XLColor.White;
            }
            row++;

            foreach (var dataRow in table.Rows)
            {
                for (var c = 0; c < dataRow.Count; c++)
                {
                    sheet.Cell(row, c + 1).Value = dataRow[c];
                }
                row++;
            }
            row++;
        }

        if (report.Insights.Count > 0)
        {
            sheet.Cell(row, 1).Value = "Key Insights";
            sheet.Cell(row, 1).Style.Font.Bold = true;
            sheet.Cell(row, 1).Style.Font.FontSize = 12;
            row++;
            foreach (var insight in report.Insights)
            {
                sheet.Cell(row, 1).Value = $"• {insight}";
                sheet.Range(row, 1, row, 4).Merge();
                row++;
            }
            row++;
        }

        if (report.Recommendations.Count > 0)
        {
            sheet.Cell(row, 1).Value = "Recommendations";
            sheet.Cell(row, 1).Style.Font.Bold = true;
            sheet.Cell(row, 1).Style.Font.FontSize = 12;
            row++;
            foreach (var rec in report.Recommendations)
            {
                sheet.Cell(row, 1).Value = $"› {rec}";
                sheet.Range(row, 1, row, 4).Merge();
                row++;
            }
        }

        sheet.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }
}
