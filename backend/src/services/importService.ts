import { query, getClient } from '../config/database';
import logger from '../config/logger';
import { sanitizeForLog } from '../utils/logSanitizer';
import { sanitizeInput } from '../utils/inputSanitizer';

export interface ParsedRow {
  category: string;
  metric_name: string;
  value: number;
  recorded_at: string;
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  validRows: ParsedRow[];
}

export interface ImportResult {
  success: boolean;
  rowsImported: number;
  rowsSkipped: number;
  errors: ValidationError[];
}

/**
 * Parse CSV buffer into structured data
 */
export const parseCSV = (buffer: Buffer): ParsedRow[] => {
  const content = buffer.toString('utf-8');
  const lines = content.split(/\r?\n/).filter(line => line.trim());

  if (lines.length < 2) {
    throw new Error('CSV file must contain a header row and at least one data row');
  }

  const headers = lines[0].toLowerCase().split(',').map(h => h.trim());

  // Validate headers
  const requiredHeaders = ['category', 'metric_name', 'value', 'recorded_at'];
  const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

  if (missingHeaders.length > 0) {
    throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
  }

  const categoryIndex = headers.indexOf('category');
  const metricNameIndex = headers.indexOf('metric_name');
  const valueIndex = headers.indexOf('value');
  const recordedAtIndex = headers.indexOf('recorded_at');

  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);

    if (values.length >= 4) {
      rows.push({
        category: sanitizeInput(values[categoryIndex], 100),
        metric_name: sanitizeInput(values[metricNameIndex], 255),
        value: parseFloat(values[valueIndex].trim()),
        recorded_at: sanitizeInput(values[recordedAtIndex], 50),
      });
    }
  }

  return rows;
};

/**
 * Parse a single CSV line handling quoted values
 */
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
};

/**
 * Validate parsed data against expected format
 */
export const validateData = async (rows: ParsedRow[]): Promise<ValidationResult> => {
  const errors: ValidationError[] = [];
  const validRows: ParsedRow[] = [];

  // Get valid categories from database
  const categoriesResult = await query('SELECT slug FROM categories');
  const validCategories = new Set(categoriesResult.rows.map(r => r.slug));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2; // +2 for 1-indexed and header row
    let hasError = false;

    // Validate category
    if (!row.category) {
      errors.push({
        row: rowNumber,
        field: 'category',
        message: 'Category is required',
      });
      hasError = true;
    } else if (!validCategories.has(row.category)) {
      errors.push({
        row: rowNumber,
        field: 'category',
        message: `Invalid category: "${row.category}". Valid categories: ${Array.from(validCategories).join(', ')}`,
      });
      hasError = true;
    }

    // Validate metric_name
    if (!row.metric_name) {
      errors.push({
        row: rowNumber,
        field: 'metric_name',
        message: 'Metric name is required',
      });
      hasError = true;
    }

    // Validate value
    if (isNaN(row.value)) {
      errors.push({
        row: rowNumber,
        field: 'value',
        message: 'Value must be a valid number',
      });
      hasError = true;
    } else if (row.value < 0) {
      errors.push({
        row: rowNumber,
        field: 'value',
        message: 'Value must be non-negative',
      });
      hasError = true;
    }

    // Validate recorded_at
    if (!row.recorded_at) {
      errors.push({
        row: rowNumber,
        field: 'recorded_at',
        message: 'Recorded date is required',
      });
      hasError = true;
    } else {
      const date = new Date(row.recorded_at);
      if (isNaN(date.getTime())) {
        errors.push({
          row: rowNumber,
          field: 'recorded_at',
          message: 'Invalid date format. Expected YYYY-MM-DD',
        });
        hasError = true;
      }
    }

    if (!hasError) {
      validRows.push(row);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    validRows,
  };
};

/**
 * Import metrics into database
 */
export const importMetrics = async (rows: ParsedRow[]): Promise<ImportResult> => {
  const client = await getClient();
  const errors: ValidationError[] = [];
  let rowsImported = 0;
  let rowsSkipped = 0;

  try {
    await client.query('BEGIN');

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      try {
        // Get category ID
        const categoryResult = await client.query(
          'SELECT id FROM categories WHERE slug = $1',
          [row.category]
        );

        if (categoryResult.rows.length === 0) {
          errors.push({
            row: rowNumber,
            field: 'category',
            message: `Category not found: ${row.category}`,
          });
          rowsSkipped++;
          continue;
        }

        const categoryId = categoryResult.rows[0].id;

        // Find or create metric definition
        const metricSlug = row.metric_name.toLowerCase().replace(/\s+/g, '_');

        let metricResult = await client.query(
          'SELECT id FROM metric_definitions WHERE category_id = $1 AND slug = $2',
          [categoryId, metricSlug]
        );

        let metricId: number;

        if (metricResult.rows.length === 0) {
          // Create new metric definition
          const insertMetricResult = await client.query(
            `INSERT INTO metric_definitions (category_id, slug, name, is_active, display_order)
             VALUES ($1, $2, $3, true, (SELECT COALESCE(MAX(display_order), 0) + 1 FROM metric_definitions WHERE category_id = $1))
             RETURNING id`,
            [categoryId, metricSlug, row.metric_name]
          );
          metricId = insertMetricResult.rows[0].id;
          logger.info('Created new metric definition', { metricName: sanitizeForLog(row.metric_name) });
        } else {
          metricId = metricResult.rows[0].id;
        }

        // Check if value already exists for this metric and date
        const existingValue = await client.query(
          'SELECT id FROM metric_values WHERE metric_id = $1 AND DATE(recorded_at) = DATE($2)',
          [metricId, row.recorded_at]
        );

        if (existingValue.rows.length > 0) {
          // Update existing value
          await client.query(
            'UPDATE metric_values SET metric_count = $1, updated_at = NOW() WHERE id = $2',
            [row.value, existingValue.rows[0].id]
          );
          logger.info('Updated metric value', {
            metricName: sanitizeForLog(row.metric_name),
            recordedAt: sanitizeForLog(row.recorded_at)
          });
        } else {
          // Insert new value
          await client.query(
            `INSERT INTO metric_values (metric_id, metric_count, recorded_at)
             VALUES ($1, $2, $3)`,
            [metricId, row.value, row.recorded_at]
          );
        }

        rowsImported++;
      } catch (error) {
        logger.error('Error importing row', { rowNumber, error });
        errors.push({
          row: rowNumber,
          field: 'general',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        rowsSkipped++;
      }
    }

    await client.query('COMMIT');

    return {
      success: true,
      rowsImported,
      rowsSkipped,
      errors,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Import transaction failed', { error });
    throw error;
  } finally {
    client.release();
  }
};

export const importService = {
  parseCSV,
  validateData,
  importMetrics,
};

export default importService;
