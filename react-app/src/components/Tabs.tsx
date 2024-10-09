import React from 'react';
import { NavLink } from 'react-router-dom';
import '../style/Tabs.css';

const Tabs: React.FC = () => {
  return (
    <div className="tabs-container">
      <NavLink
        to="/overview"
        className={({ isActive }) => (isActive ? 'tab-button active' : 'tab-button')}
      >
        Overview
      </NavLink>
      <NavLink
        to="/traffic"
        className={({ isActive }) => (isActive ? 'tab-button active' : 'tab-button')}
      >
        Traffic
      </NavLink>
      <NavLink
        to="/performance"
        className={({ isActive }) => (isActive ? 'tab-button active' : 'tab-button')}
      >
        Site Performance
      </NavLink>
    </div>
  );
};

export default Tabs;