import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import { metricsService } from './metricsService';
import { DateRange, CategoryWithMetrics } from '../types';
import { sanitizeForCSV } from '../utils/csvSanitizer';

export const exportService = {
  async generateCSV(
    categorySlug: string | 'all',
    range: DateRange
  ): Promise<{ content: string; filename: string }> {
    let data: CategoryWithMetrics[];

    if (categorySlug === 'all') {
      data = await metricsService.getAllMetrics(range);
    } else {
      const categoryData = await metricsService.getMetricsByCategory(categorySlug, range);
      data = [categoryData];
    }

    // Build CSV content
    const headers = ['Category', 'Metric Name', 'Count', 'Week-Over-Week Change', 'Percentile', 'Recorded At'];
    const rows: string[] = [headers.join(',')];

    for (const category of data) {
      for (const metric of category.metrics) {
        const row = [
          sanitizeForCSV(category.category.name),
          sanitizeForCSV(metric.name),
          metric.count.toString(),
          metric.weekOverWeekChange !== null ? `${metric.weekOverWeekChange}%` : '',
          metric.percentile !== null ? `${metric.percentile}th` : '',
          metric.recordedAt || '',
        ];
        rows.push(row.join(','));
      }
    }

    const filename = `metrics-${categorySlug}-${range}-${new Date().toISOString().split('T')[0]}.csv`;

    return {
      content: rows.join('\n'),
      filename,
    };
  },

  async generatePDF(
    categorySlug: string | 'all',
    range: DateRange
  ): Promise<{ buffer: Buffer; filename: string }> {
    let data: CategoryWithMetrics[];

    if (categorySlug === 'all') {
      data = await metricsService.getAllMetrics(range);
    } else {
      const categoryData = await metricsService.getMetricsByCategory(categorySlug, range);
      data = [categoryData];
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const filename = `metrics-report-${categorySlug}-${range}-${new Date().toISOString().split('T')[0]}.pdf`;
        resolve({ buffer, filename });
      });
      doc.on('error', reject);

      // Title
      doc
        .fontSize(24)
        .font('Helvetica-Bold')
        .text('Performance Metrics Report', { align: 'center' });

      doc.moveDown();

      // Date range info
      if (data.length > 0) {
        doc
          .fontSize(12)
          .font('Helvetica')
          .text(`Report Period: ${data[0].dateRange.from} to ${data[0].dateRange.to}`, { align: 'center' });

        doc
          .text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
      }

      doc.moveDown(2);

      // Metrics by category
      for (const category of data) {
        // Category header
        doc
          .fontSize(16)
          .font('Helvetica-Bold')
          .fillColor('#2c3e50')
          .text(category.category.name);

        doc.moveDown(0.5);

        // Table header
        const tableTop = doc.y;
        const col1 = 50;
        const col2 = 250;
        const col3 = 330;
        const col4 = 410;
        const col5 = 490;

        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#7f8c8d')
          .text('Metric', col1, tableTop)
          .text('Count', col2, tableTop)
          .text('WoW', col3, tableTop)
          .text('Percentile', col4, tableTop);

        doc.moveDown(0.5);

        // Draw line under header
        doc
          .strokeColor('#bdc3c7')
          .lineWidth(1)
          .moveTo(col1, doc.y)
          .lineTo(550, doc.y)
          .stroke();

        doc.moveDown(0.5);

        // Metrics rows
        for (const metric of category.metrics) {
          const y = doc.y;

          // Determine color based on week-over-week change
          const wowColor = metric.weekOverWeekChange === null
            ? '#7f8c8d'
            : metric.weekOverWeekChange >= 0
              ? '#27ae60'
              : '#e74c3c';

          doc
            .fontSize(10)
            .font('Helvetica')
            .fillColor('#2c3e50')
            .text(metric.name, col1, y, { width: 190 })
            .fillColor('#2c3e50')
            .text(metric.count.toLocaleString(), col2, y)
            .fillColor(wowColor)
            .text(
              metric.weekOverWeekChange !== null
                ? `${metric.weekOverWeekChange >= 0 ? '+' : ''}${metric.weekOverWeekChange}%`
                : 'N/A',
              col3, y
            )
            .fillColor('#2c3e50')
            .text(
              metric.percentile !== null ? `${metric.percentile}th` : 'N/A',
              col4, y
            );

          doc.moveDown(0.8);

          // Check if we need a new page
          if (doc.y > 700) {
            doc.addPage();
          }
        }

        doc.moveDown(1.5);

        // Check if we need a new page before next category
        if (doc.y > 650 && data.indexOf(category) < data.length - 1) {
          doc.addPage();
        }
      }

      // Footer
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc
          .fontSize(8)
          .fillColor('#7f8c8d')
          .text(
            `Page ${i + 1} of ${pageCount} | Benchmetrics Dashboard`,
            50,
            doc.page.height - 50,
            { align: 'center' }
          );
      }

      doc.end();
    });
  },
};

export default exportService;
