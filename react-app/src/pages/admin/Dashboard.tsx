import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import LoadingSpinner from '../../components/LoadingSpinner';
import './Admin.css';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalMetrics: number;
  totalCategories: number;
  recentSignups: number;
  usersByRole: {
    admin: number;
    editor: number;
    viewer: number;
  };
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get<DashboardStats>('/api/admin/stats');
        if (response.success && response.data) {
          setStats(response.data);
        } else {
          setError(response.error?.message || 'Failed to load stats');
        }
      } catch (err) {
        setError('Failed to load dashboard statistics');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="admin-loading">
        <LoadingSpinner size="large" />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-error">
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1>Admin Dashboard</h1>
        <p className="admin-subtitle">System overview and statistics</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon users-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.totalUsers}</span>
            <span className="stat-label">Total Users</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon active-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.activeUsers}</span>
            <span className="stat-label">Active Users</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon metrics-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.totalMetrics}</span>
            <span className="stat-label">Active Metrics</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon categories-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.totalCategories}</span>
            <span className="stat-label">Categories</span>
          </div>
        </div>

        <div className="stat-card highlight">
          <div className="stat-icon signups-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.recentSignups}</span>
            <span className="stat-label">New Users (7 days)</span>
          </div>
        </div>
      </div>

      <div className="admin-section">
        <h2>Users by Role</h2>
        <div className="role-stats">
          <div className="role-stat">
            <span className="role-badge admin">Admin</span>
            <span className="role-count">{stats.usersByRole.admin}</span>
          </div>
          <div className="role-stat">
            <span className="role-badge editor">Editor</span>
            <span className="role-count">{stats.usersByRole.editor}</span>
          </div>
          <div className="role-stat">
            <span className="role-badge viewer">Viewer</span>
            <span className="role-count">{stats.usersByRole.viewer}</span>
          </div>
        </div>
      </div>

      <div className="admin-section">
        <h2>Quick Actions</h2>
        <div className="quick-actions">
          <Link to="/admin/users" className="action-button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Manage Users
          </Link>
          <Link to="/admin/import" className="action-button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Import Data
          </Link>
          <Link to="/admin/audit-log" className="action-button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            Audit Log
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
