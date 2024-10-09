## Description

This project is a full-stack application designed to display performance metrics for a website using a React-based frontend and an Express.js backend. The project reads data from a CSV file, processes it on the backend, and provides RESTful APIs that the frontend consumes to display the data in a user-friendly interface.

The frontend features a tabbed interface where users can navigate between three key sections:

	•	Overview: Displays high-level website traffic data, including sessions, bounce rates, and more.
	•	Traffic: Shows traffic sources such as direct traffic, organic search, social traffic, and referrals.
	•	Site Performance: Presents key performance indicators such as user sessions, page entries, and session duration.

This project aims to provide insights into website performance in an intuitive and easy-to-understand layout, and it is ideal for business owners, marketing professionals, or technical teams who want to monitor key metrics for site optimization.

## Features

	•	Tabbed Navigation: Users can switch between different metrics categories (Overview, Traffic, Site Performance) easily using a tabbed navigation bar.
	•	Responsive UI: The frontend, built with React, provides a modern, responsive, and clean user interface to view metrics on desktop and mobile devices.
	•	CSV Data Parsing: The backend uses Express.js to read and parse CSV files containing the performance data, providing the frontend with processed data via a REST API.
	•	RESTful API: A lightweight API provides the necessary data endpoints for the frontend:
	•	/api/overview: Overview metrics including site traffic, bounce rates, and time on site.
	•	/api/traffic: Traffic metrics showing different traffic sources like direct, organic, and social.
	•	/api/performance: Performance metrics like users, session durations, and page entries.
	•	Dynamic Data Representation: The data is displayed in styled cards, and the week-over-week performance changes are highlighted using color-coded indicators (e.g., red for negative, green for positive).
	•	Data Transformation: The backend processes raw CSV data to format it in a meaningful way for the frontend, transforming and filtering only the relevant metrics for each category.
	•	Custom Metric Display: Each card includes key metrics like the “Metric Count”, “Percentile”, and “Week-Over-Week Change” with icons indicating performance trends.
	•	Test Coverage: Both frontend and backend components include unit tests written with Jest, ensuring reliability and stability for the core features.
	•	Full-Stack Integration: The project seamlessly integrates a frontend built with React and TypeScript and a backend with Node.js and Express, offering a complete solution to handle data from CSV to UI display.

## Setup Instructions

### 1. Prerequisites

Make sure you have the following installed:

- Node.js (v16.x or later)
- npm (v8.x or later)

```bash
brew install node
node -v
npm -v
```

### 2. Installation

#### A. Clone project:

```bash
git clone <repository-url>
cd <repository-directory>
```

#### B. Install dependencies:
- For both backend and Frontend you need to install dependencies
```bash
npm install
```

#### C. Configure the environment:

Create a .env file at the project root with the following variables:

```bash
PORT=5001
```

#### D. Start the application:
```bash
cd backend
npm run dev
```

```bash
cd react-app
npm run start
```

#### E. Run frontend tests:

Run all tests in react-app.

```bash
npm run test
```

#### F. Import Data To Project:
-  Backend
```text
data.csv file should be backend/src/data
```
-  Frontend
```text
CSS assets should be react-app/public/assets
```