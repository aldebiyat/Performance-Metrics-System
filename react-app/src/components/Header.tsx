import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../api/client';
import '../style/Header.css';

interface Organization {
  id: number;
  name: string;
  slug: string;
  user_role: string;
}

interface OrganizationData {
  organizations: Organization[];
  currentOrganization: Organization | null;
}

const Header: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isOrgMenuOpen, setIsOrgMenuOpen] = useState(false);
  const [orgData, setOrgData] = useState<OrganizationData | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const orgMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith('/admin');

  const fetchOrganizations = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const response = await api.get<OrganizationData>('/api/organizations');
      if (response.success && response.data) {
        setOrgData(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch organizations:', err);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (orgMenuRef.current && !orgMenuRef.current.contains(event.target as Node)) {
        setIsOrgMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    setIsMenuOpen(false);
  };

  const handleSwitchOrganization = async (orgId: number) => {
    try {
      const response = await api.post<{ message: string; currentOrganization: Organization }>(
        `/api/organizations/${orgId}/switch`,
        {}
      );
      if (response.success) {
        await fetchOrganizations();
        setIsOrgMenuOpen(false);
      }
    } catch (err) {
      console.error('Failed to switch organization:', err);
    }
  };

  return (
    <header className="header">
      <div className="logo-container">
        <Link to="/">
          <img src="/assets/BNM_Logo_White.png" alt="Benchmetrics Logo" className="logo" />
        </Link>
      </div>

      <div className="header-nav">
        {/* Organization Switcher */}
        {isAuthenticated && orgData && orgData.organizations.length > 0 && (
          <div className="org-switcher-container" ref={orgMenuRef}>
            <button
              className="org-switcher-button"
              onClick={() => setIsOrgMenuOpen(!isOrgMenuOpen)}
            >
              <span className="org-icon">
                {orgData.currentOrganization
                  ? orgData.currentOrganization.name.charAt(0).toUpperCase()
                  : 'O'}
              </span>
              <span className="org-name-display">
                {orgData.currentOrganization?.name || 'Select Organization'}
              </span>
              <span className="dropdown-arrow">{isOrgMenuOpen ? '▲' : '▼'}</span>
            </button>

            {isOrgMenuOpen && (
              <div className="org-dropdown">
                <div className="org-dropdown-header">Organizations</div>
                {orgData.organizations.map((org) => (
                  <button
                    key={org.id}
                    className={`org-dropdown-item ${
                      orgData.currentOrganization?.id === org.id ? 'active' : ''
                    }`}
                    onClick={() => handleSwitchOrganization(org.id)}
                  >
                    <span className="org-item-avatar">{org.name.charAt(0).toUpperCase()}</span>
                    <span className="org-item-info">
                      <span className="org-item-name">{org.name}</span>
                      <span className="org-item-role">{org.user_role}</span>
                    </span>
                    {orgData.currentOrganization?.id === org.id && (
                      <span className="org-current-check">&#10003;</span>
                    )}
                  </button>
                ))}
                <div className="org-dropdown-divider"></div>
                <Link
                  to="/settings/organization"
                  className="org-dropdown-item org-settings-link"
                  onClick={() => setIsOrgMenuOpen(false)}
                >
                  <span className="org-settings-icon">&#9881;</span>
                  <span>Organization Settings</span>
                </Link>
              </div>
            )}
          </div>
        )}

        {isAuthenticated && user?.role === 'admin' && (
          <Link
            to={isAdminPage ? '/' : '/admin'}
            className="admin-nav-link"
          >
            {isAdminPage ? 'Dashboard' : 'Admin'}
          </Link>
        )}
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? (
            <span className="theme-icon">&#9790;</span>
          ) : (
            <span className="theme-icon">&#9728;</span>
          )}
        </button>
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
              <Link
                to="/settings/organization"
                className="dropdown-item"
                onClick={() => setIsMenuOpen(false)}
              >
                Organization Settings
              </Link>
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
