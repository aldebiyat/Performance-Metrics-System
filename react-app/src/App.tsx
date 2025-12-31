import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Tabs from './components/Tabs';
import Overview from './pages/Overview';
import Traffic from './pages/Traffic';
import SitePerformance from './pages/SitePerformance';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Header from './components/Header';
import DateRangeFilter from './components/DateRangeFilter';
import ExportButton from './components/ExportButton';
import { DateRange } from './types';
import './App.css';

const Dashboard: React.FC = () => {
  const [dateRange, setDateRange] = useState<DateRange>('30d');

  return (
    <>
      <Header />
      <div className="menu-bar">
        <Tabs />
      </div>
      <div className="toolbar">
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
        <ExportButton range={dateRange} />
      </div>
      <div className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/overview" />} />
          <Route path="/overview" element={<Overview dateRange={dateRange} />} />
          <Route path="/traffic" element={<Traffic dateRange={dateRange} />} />
          <Route path="/performance" element={<SitePerformance dateRange={dateRange} />} />
        </Routes>
      </div>
    </>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App;
