"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
// Path to CSV file
const csvFilePath = path_1.default.join(__dirname, 'data/data.csv');
// Helper function to parse CSV file and return data
const parseCSV = (callback) => {
    const results = [];
    fs_1.default.createReadStream(csvFilePath)
        .pipe((0, csv_parser_1.default)())
        .on('data', (data) => results.push(data))
        .on('end', () => {
        callback(results);
    });
};
// API endpoint for Overview metrics
app.get('/api/overview', (req, res) => {
    parseCSV((data) => {
        const overview = data.filter((row) => [
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
        const traffic = data.filter((row) => [
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
        const performance = data.filter((row) => [
            'Users',
            'Two or More Sessions',
            'Internal Page Entries',
            'Sessions > 1 Min.'
        ].includes(row['Metric Name']));
        res.json(performance);
    });
});
// Start the server
app.listen(5000, () => {
    console.log('Server is running on http://localhost:5000');
});
