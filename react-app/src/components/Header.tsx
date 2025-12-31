import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../style/Header.css';

const Header: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith('/admin');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    setIsMenuOpen(false);
  };

  return (
    <header className="header">
      <div className="logo-container">
        <Link to="/">
          <img src="/assets/BNM_Logo_White.png" alt="Benchmetrics Logo" className="logo" />
        </Link>
      </div>

      <div className="header-nav">
        {isAuthenticated && user?.role === 'admin' && (
          <Link
            to={isAdminPage ? '/' : '/admin'}
            className="admin-nav-link"
          >
            {isAdminPage ? 'Dashboard' : 'Admin'}
          </Link>
        )}
      </div>

      {isAuthenticated && user && (
        <div className="user-menu-container" ref={menuRef}>
          <button
            className="user-menu-button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <span className="user-avatar">
              {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
            </span>
            <span className="user-name">{user.name || user.email}</span>
            <span className="dropdown-arrow">{isMenuOpen ? '▲' : '▼'}</span>
          </button>

          {isMenuOpen && (
            <div className="user-dropdown">
              <div className="user-info">
                <span className="user-email">{user.email}</span>
                <span className="user-role">{user.role}</span>
              </div>
              <div className="dropdown-divider"></div>
              <button className="dropdown-item logout-button" onClick={handleLogout}>
                Sign out
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default Header;
