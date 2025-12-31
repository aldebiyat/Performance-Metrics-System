import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import LoadingSpinner from '../../components/LoadingSpinner';
import './Admin.css';

interface AuditLogEntry {
  id: number;
  user_id: number | null;
  user_email: string | null;
  user_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  old_values: object | null;
  new_values: object | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface AuditLogsResponse {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  USER_REGISTERED: { label: 'User Registered', color: '#10b981' },
  USER_LOGIN: { label: 'User Login', color: '#3b82f6' },
  USER_LOGOUT: { label: 'User Logout', color: '#6b7280' },
  PASSWORD_RESET: { label: 'Password Reset', color: '#f59e0b' },
  USER_UPDATED: { label: 'User Updated', color: '#8b5cf6' },
  USER_DELETED: { label: 'User Deleted', color: '#ef4444' },
  DATA_IMPORTED: { label: 'Data Imported', color: '#06b6d4' },
};

const AuditLog: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string>('');

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (actionFilter) {
        params.append('action', actionFilter);
      }

      const response = await api.get<AuditLogsResponse>(`/api/admin/audit-logs?${params}`);

      if (response.success && response.data) {
        setLogs(response.data.logs);
        setTotal(response.data.total);
      } else {
        setError(response.error?.message || 'Failed to load audit logs');
      }
    } catch (err) {
      setError('Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(total / limit);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatJson = (obj: object | null) => {
    if (!obj) return '-';
    return JSON.stringify(obj, null, 2);
  };

  const getActionBadge = (action: string) => {
    const config = ACTION_LABELS[action] || { label: action, color: '#6b7280' };
    return (
      <span
        className="action-badge"
        style={{ backgroundColor: `${config.color}20`, color: config.color }}
      >
        {config.label}
      </span>
    );
  };

  if (isLoading && logs.length === 0) {
    return (
      <div className="admin-loading">
        <LoadingSpinner size="large" />
        <p>Loading audit logs...</p>
      </div>
    );
  }

  if (error && logs.length === 0) {
    return (
      <div className="admin-error">
        <p>{error}</p>
        <button onClick={fetchLogs}>Retry</button>
      </div>
    );
  }

  return (
    <div className="admin-audit-log">
      <div className="header-with-back">
        <Link to="/admin" className="back-link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>
      </div>

      <div className="admin-header">
        <h1>Audit Log</h1>
        <p className="admin-subtitle">Track system activity and user actions</p>
      </div>

      <div className="audit-toolbar">
        <div className="filter-group">
          <label htmlFor="action-filter">Filter by Action:</label>
          <select
            id="action-filter"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="action-filter-select"
          >
            <option value="">All Actions</option>
            {Object.entries(ACTION_LABELS).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <span className="logs-count">{total} total entries</span>
      </div>

      <div className="audit-table-container">
        <table className="audit-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Details</th>
              <th>IP Address</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="timestamp-cell">{formatDate(log.created_at)}</td>
                <td className="user-cell">
                  {log.user_email ? (
                    <div className="user-info">
                      <span className="user-name">{log.user_name || 'Unknown'}</span>
                      <span className="user-email">{log.user_email}</span>
                    </div>
                  ) : (
                    <span className="no-user">System</span>
                  )}
                </td>
                <td>{getActionBadge(log.action)}</td>
                <td className="entity-cell">
                  {log.entity_type ? (
                    <span>
                      {log.entity_type}
                      {log.entity_id && ` #${log.entity_id}`}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="details-cell">
                  {(log.old_values || log.new_values) ? (
                    <details className="json-details">
                      <summary>View Changes</summary>
                      <div className="json-content">
                        {log.old_values && (
                          <div className="json-section">
                            <strong>Old Values:</strong>
                            <pre>{formatJson(log.old_values)}</pre>
                          </div>
                        )}
                        {log.new_values && (
                          <div className="json-section">
                            <strong>New Values:</strong>
                            <pre>{formatJson(log.new_values)}</pre>
                          </div>
                        )}
                      </div>
                    </details>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="ip-cell">{log.ip_address || '-'}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="no-data">
                  No audit logs found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="page-button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </button>
          <span className="page-info">
            Page {page} of {totalPages}
          </span>
          <button
            className="page-button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default AuditLog;
