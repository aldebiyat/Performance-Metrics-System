import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Tabs from './components/Tabs';
import Overview from './pages/Overview';
import Traffic from './pages/Traffic';
import SitePerformance from './pages/SitePerformance';
import Header from './components/Header';
import './App.css';

const App: React.FC = () => {
  return (
    <Router>
      <div className="App">
        <Header />
        <div className="menu-bar">
          <Tabs />
        </div>
        <div className="content">
          <Routes>
            <Route path="/" element={<Navigate to="/overview" />} />
            <Route path="/overview" element={<Overview />} />
            <Route path="/traffic" element={<Traffic />} />
            <Route path="/performance" element={<SitePerformance />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

export default App;