import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import './Admin.css';

interface AdminUser {
  id: number;
  email: string;
  name: string | null;
  role: 'admin' | 'editor' | 'viewer';
  is_active: boolean;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

interface PaginatedUsers {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const AdminUsers: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [data, setData] = useState<PaginatedUsers | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
      });
      if (search) {
        params.append('search', search);
      }

      const response = await api.get<PaginatedUsers>(`/api/admin/users?${params}`);
      if (response.success && response.data) {
        setData(response.data);
        setError(null);
      } else {
        setError(response.error?.message || 'Failed to load users');
      }
    } catch (err) {
      setError('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleUpdateUser = async (userId: number, updates: Partial<AdminUser>) => {
    try {
      setActionLoading(userId);
      const response = await api.put<AdminUser>(`/api/admin/users/${userId}`, updates);
      if (response.success && response.data) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                users: prev.users.map((u) => (u.id === userId ? response.data! : u)),
              }
            : null
        );
        setEditingUser(null);
      } else {
        alert(response.error?.message || 'Failed to update user');
      }
    } catch (err) {
      alert('Failed to update user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      setActionLoading(userId);
      const response = await api.delete<{ message: string }>(`/api/admin/users/${userId}`);
      if (response.success) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                users: prev.users.filter((u) => u.id !== userId),
                total: prev.total - 1,
              }
            : null
        );
        setDeleteConfirm(null);
      } else {
        alert(response.error?.message || 'Failed to delete user');
      }
    } catch (err) {
      alert('Failed to delete user');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading && !data) {
    return (
      <div className="admin-loading">
        <LoadingSpinner size="large" />
        <p>Loading users...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="admin-error">
        <p>{error}</p>
        <button onClick={fetchUsers}>Retry</button>
      </div>
    );
  }

  return (
    <div className="admin-users">
      <div className="admin-header">
        <h1>User Management</h1>
        <p className="admin-subtitle">Manage user accounts and permissions</p>
      </div>

      <div className="users-toolbar">
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder="Search by email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="search-button">
            Search
          </button>
        </form>
        {data && (
          <span className="users-count">
            {data.total} user{data.total !== 1 ? 's' : ''} found
          </span>
        )}
      </div>

      {data && (
        <>
          <div className="users-table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Email Verified</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((user) => (
                  <tr key={user.id} className={!user.is_active ? 'inactive' : ''}>
                    <td className="user-cell">
                      <div className="user-info-cell">
                        <span className="user-avatar-small">
                          {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                        </span>
                        <div>
                          <div className="user-name-cell">{user.name || '-'}</div>
                          <div className="user-email-cell">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {editingUser?.id === user.id ? (
                        <select
                          value={editingUser.role}
                          onChange={(e) =>
                            setEditingUser({
                              ...editingUser,
                              role: e.target.value as 'admin' | 'editor' | 'viewer',
                            })
                          }
                          className="role-select"
                          disabled={user.id === currentUser?.id}
                        >
                          <option value="admin">Admin</option>
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      ) : (
                        <span className={`role-badge ${user.role}`}>{user.role}</span>
                      )}
                    </td>
                    <td>
                      {editingUser?.id === user.id ? (
                        <label className="toggle-label">
                          <input
                            type="checkbox"
                            checked={editingUser.is_active}
                            onChange={(e) =>
                              setEditingUser({ ...editingUser, is_active: e.target.checked })
                            }
                            disabled={user.id === currentUser?.id}
                          />
                          <span className="toggle-text">
                            {editingUser.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </label>
                      ) : (
                        <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`verified-badge ${user.email_verified ? 'verified' : 'unverified'}`}>
                        {user.email_verified ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td>{formatDate(user.created_at)}</td>
                    <td className="actions-cell">
                      {actionLoading === user.id ? (
                        <LoadingSpinner size="small" />
                      ) : deleteConfirm === user.id ? (
                        <div className="delete-confirm">
                          <span>Delete?</span>
                          <button
                            className="confirm-yes"
                            onClick={() => handleDeleteUser(user.id)}
                          >
                            Yes
                          </button>
                          <button
                            className="confirm-no"
                            onClick={() => setDeleteConfirm(null)}
                          >
                            No
                          </button>
                        </div>
                      ) : editingUser?.id === user.id ? (
                        <div className="edit-actions">
                          <button
                            className="save-button"
                            onClick={() =>
                              handleUpdateUser(user.id, {
                                role: editingUser.role,
                                is_active: editingUser.is_active,
                              })
                            }
                          >
                            Save
                          </button>
                          <button
                            className="cancel-button"
                            onClick={() => setEditingUser(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="action-buttons">
                          <button
                            className="edit-button"
                            onClick={() => setEditingUser(user)}
                            title="Edit user"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          {user.id !== currentUser?.id && (
                            <button
                              className="delete-button"
                              onClick={() => setDeleteConfirm(user.id)}
                              title="Delete user"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                              </svg>
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.totalPages > 1 && (
            <div className="pagination">
              <button
                className="page-button"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <span className="page-info">
                Page {page} of {data.totalPages}
              </span>
              <button
                className="page-button"
                disabled={page === data.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminUsers;
