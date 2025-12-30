import { query } from '../config/database';
import fs from 'fs';
import path from 'path';

interface CSVRow {
  name: string;
  count: number | null;
  weekOverWeekChange: number | null;
  percentile: number | null;
}

// Map CSV metric names to categories
const metricCategoryMap: Record<string, string> = {
  'Sessions (Site Traffic)': 'overview',
  'Avg. Pages Viewed': 'overview',
  'Avg. Time on Site': 'overview',
  'Bounce Rate': 'overview',
  'Direct Traffic': 'traffic',
  'Organic Search': 'traffic',
  'Social Traffic': 'traffic',
  'Referral Traffic': 'traffic',
  'Users': 'performance',
  'Two or More Sessions': 'performance',
  'Internal Page Entries': 'performance',
  'Sessions > 1 Min.': 'performance',
};

// Parse CSV value to number
const parseValue = (value: string): number | null => {
  if (!value || value.trim() === '') return null;
  // Remove %, s, th suffixes and parse
  const cleaned = value.replace(/[%sth]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

// Generate slug from name
const toSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
};

export async function initializeDatabase(): Promise<void> {
  console.log('Initializing database schema...');

  // Read and execute schema
  const schemaPath = path.join(__dirname, '../config/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  // Split by semicolon and execute each statement
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    try {
      await query(statement);
    } catch (err: any) {
      // Ignore "already exists" errors
      if (!err.message.includes('already exists')) {
        console.error('Schema error:', err.message);
      }
    }
  }

  console.log('Database schema initialized.');
}

export async function seedFromCSV(): Promise<void> {
  console.log('Checking if seed data exists...');

  // Check if data already exists
  const existingData = await query('SELECT COUNT(*) FROM categories');
  if (parseInt(existingData.rows[0].count) > 0) {
    console.log('Data already seeded, skipping...');
    return;
  }

  console.log('Seeding data from CSV...');

  // Insert categories
  const categories = [
    { slug: 'overview', name: 'Overview', display_order: 1 },
    { slug: 'traffic', name: 'Traffic Sources', display_order: 2 },
    { slug: 'performance', name: 'Site Performance', display_order: 3 },
  ];

  for (const cat of categories) {
    await query(
      'INSERT INTO categories (slug, name, display_order) VALUES ($1, $2, $3) ON CONFLICT (slug) DO NOTHING',
      [cat.slug, cat.name, cat.display_order]
    );
  }

  // Get category IDs
  const categoryResult = await query('SELECT id, slug FROM categories');
  const categoryIdMap: Record<string, number> = {};
  for (const row of categoryResult.rows) {
    categoryIdMap[row.slug] = row.id;
  }

  // Read CSV file
  const csvPath = path.join(__dirname, '../data/data.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.trim().split('\n');

  // Skip header, parse rows
  const rows: CSVRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const [name, count, weekChange, percentile] = lines[i].split(',');

    if (!name || !metricCategoryMap[name]) continue;

    rows.push({
      name: name.trim(),
      count: parseValue(count),
      weekOverWeekChange: parseValue(weekChange),
      percentile: parseValue(percentile),
    });
  }

  // Insert metric definitions and values
  const today = new Date().toISOString().split('T')[0];
  let displayOrder = 1;

  for (const row of rows) {
    const categorySlug = metricCategoryMap[row.name];
    const categoryId = categoryIdMap[categorySlug];

    if (!categoryId) continue;

    // Insert metric definition
    const metricResult = await query(
      `INSERT INTO metric_definitions (category_id, slug, name, display_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (category_id, slug) DO UPDATE SET name = $3
       RETURNING id`,
      [categoryId, toSlug(row.name), row.name, displayOrder++]
    );

    const metricId = metricResult.rows[0].id;

    // Insert metric value if count exists
    if (row.count !== null) {
      await query(
        `INSERT INTO metric_values (metric_id, metric_count, week_over_week_change, percentile, recorded_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (metric_id, recorded_at) DO UPDATE
         SET metric_count = $2, week_over_week_change = $3, percentile = $4`,
        [metricId, Math.round(row.count), row.weekOverWeekChange, row.percentile, today]
      );
    }
  }

  console.log('Data seeded successfully.');
}

export async function runMigrations(): Promise<void> {
  await initializeDatabase();
  await seedFromCSV();
}
