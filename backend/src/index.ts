import express from 'express';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import cors from 'cors';

interface MetricRow {
    'Metric Name': string;
    'Metric Count': string;
    'Week-Over-Week Change': string;
    'Percentile': string;
  }

const app = express();
app.use(cors());

// Path to CSV file
const csvFilePath = path.join(__dirname, 'data', 'data.csv');

// Helper function to parse CSV file and return data
const parseCSV = (callback: (data: any) => void) => {
  const results: any[] = [];
  fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      callback(results);
    });
};

// API endpoint for Overview metrics
app.get('/api/overview', (req, res) => {
  parseCSV((data) => {
    const overview = data.filter((row: MetricRow) => [
      'Sessions (Site Traffic)', 
      'Avg. Pages Viewed', 
      'Avg. Time on Site', 
      'Bounce Rate'
    ].includes(row['Metric Name']));
    res.json(overview);
  });
});

// API endpoint for Traffic metrics
app.get('/api/traffic', (req, res) => {
  parseCSV((data) => {
    const traffic = data.filter((row: MetricRow) => [
      'Direct Traffic', 
      'Organic Search', 
      'Social Traffic', 
      'Referral Traffic'
    ].includes(row['Metric Name']));
    res.json(traffic);
  });
});

// API endpoint for Site Performance metrics
app.get('/api/performance', (req, res) => {
  parseCSV((data) => {
    const performance = data.filter((row: MetricRow) => [
      'Users', 
      'Two or More Sessions', 
      'Internal Page Entries', 
      'Sessions > 1 Min.'
    ].includes(row['Metric Name']));
    res.json(performance);
  });
});


const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});