import React from 'react';
import '../style/Header.css';

const Header: React.FC = () => {
  return (
    <header className="header">
      <div className="logo-container">
        <img src="/assets/BNM_Logo_White.png" alt="Benchmetrics Logo" className="logo" />
      </div>
    </header>
  );
};

export default Header;