import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import './admin/Admin.css';
import './OrganizationSettings.css';

interface Organization {
  id: number;
  name: string;
  slug: string;
  owner_id: number | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  user_role?: string;
}

interface OrganizationMember {
  id: number;
  organization_id: number;
  user_id: number;
  role: string;
  created_at: string;
  email: string;
  name: string | null;
}

interface OrganizationData {
  organizations: (Organization & { user_role: string })[];
  currentOrganization: (Organization & { user_role: string }) | null;
}

interface OrganizationDetails {
  organization: Organization;
  members: OrganizationMember[];
}

const OrganizationSettings: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<OrganizationData | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingMember, setEditingMember] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [addMemberEmail, setAddMemberEmail] = useState('');
  const [addMemberRole, setAddMemberRole] = useState('member');
  const [addMemberError, setAddMemberError] = useState<string | null>(null);
  const [isAddingMember, setIsAddingMember] = useState(false);

  const fetchOrganizations = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get<OrganizationData>('/api/organizations');
      if (response.success && response.data) {
        setData(response.data);
        // If there's a current organization, fetch its details
        if (response.data.currentOrganization) {
          await fetchOrgDetails(response.data.currentOrganization.id);
        }
        setError(null);
      } else {
        setError(response.error?.message || 'Failed to load organizations');
      }
    } catch (err) {
      setError('Failed to load organizations');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchOrgDetails = async (orgId: number) => {
    try {
      const response = await api.get<OrganizationDetails>(`/api/organizations/${orgId}`);
      if (response.success && response.data) {
        setSelectedOrg(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch organization details:', err);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) {
      setCreateError('Organization name is required');
      return;
    }

    try {
      setIsSubmitting(true);
      setCreateError(null);
      const response = await api.post<Organization>('/api/organizations', { name: newOrgName.trim() });
      if (response.success && response.data) {
        setNewOrgName('');
        setIsCreating(false);
        await fetchOrganizations();
      } else {
        setCreateError(response.error?.message || 'Failed to create organization');
      }
    } catch (err) {
      setCreateError('Failed to create organization');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSwitchOrganization = async (orgId: number) => {
    try {
      const response = await api.post<{ message: string; currentOrganization: Organization }>(`/api/organizations/${orgId}/switch`, {});
      if (response.success) {
        await fetchOrganizations();
      }
    } catch (err) {
      console.error('Failed to switch organization:', err);
    }
  };

  const handleUpdateMemberRole = async (memberId: number, userId: number, newRole: string) => {
    if (!selectedOrg) return;

    try {
      setActionLoading(memberId);
      const response = await api.put<OrganizationMember>(
        `/api/organizations/${selectedOrg.organization.id}/members/${userId}`,
        { role: newRole }
      );
      if (response.success && response.data) {
        setSelectedOrg({
          ...selectedOrg,
          members: selectedOrg.members.map((m) =>
            m.id === memberId ? { ...m, role: newRole } : m
          ),
        });
        setEditingMember(null);
      }
    } catch (err) {
      console.error('Failed to update member role:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!selectedOrg) return;

    try {
      setActionLoading(userId);
      const response = await api.delete<{ message: string }>(
        `/api/organizations/${selectedOrg.organization.id}/members/${userId}`
      );
      if (response.success) {
        setSelectedOrg({
          ...selectedOrg,
          members: selectedOrg.members.filter((m) => m.user_id !== userId),
        });
        setDeleteConfirm(null);
      }
    } catch (err) {
      console.error('Failed to remove member:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrg || !addMemberEmail.trim()) {
      setAddMemberError('Email is required');
      return;
    }

    try {
      setIsAddingMember(true);
      setAddMemberError(null);

      // Note: In a real implementation, you'd need to look up the user by email first
      // For now, we'll show an error message
      setAddMemberError('To add members, please use user ID. Email lookup coming soon.');
    } catch (err) {
      setAddMemberError('Failed to add member');
    } finally {
      setIsAddingMember(false);
    }
  };

  const isOrgAdmin = (org: Organization & { user_role?: string }) => {
    return org.user_role === 'admin' || org.owner_id === user?.id;
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
        <p>Loading organizations...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="admin-error">
        <p>{error}</p>
        <button onClick={fetchOrganizations}>Retry</button>
      </div>
    );
  }

  return (
    <div className="organization-settings">
      <div className="admin-header">
        <h1>Organization Settings</h1>
        <p className="admin-subtitle">Manage your organizations and team members</p>
      </div>

      {/* Organization Selector */}
      <div className="admin-section">
        <div className="section-header">
          <h2>Your Organizations</h2>
          <button
            className="action-button"
            onClick={() => setIsCreating(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create Organization
          </button>
        </div>

        {isCreating && (
          <div className="create-org-form">
            <form onSubmit={handleCreateOrganization}>
              <div className="form-row">
                <input
                  type="text"
                  placeholder="Organization name"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  className="search-input"
                  disabled={isSubmitting}
                />
                <button
                  type="submit"
                  className="action-button"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Creating...' : 'Create'}
                </button>
                <button
                  type="button"
                  className="action-button secondary"
                  onClick={() => {
                    setIsCreating(false);
                    setNewOrgName('');
                    setCreateError(null);
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
              </div>
              {createError && <p className="form-error">{createError}</p>}
            </form>
          </div>
        )}

        {data && data.organizations.length > 0 ? (
          <div className="org-list">
            {data.organizations.map((org) => (
              <div
                key={org.id}
                className={`org-card ${data.currentOrganization?.id === org.id ? 'active' : ''}`}
              >
                <div className="org-info">
                  <div className="org-avatar">
                    {org.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="org-details">
                    <div className="org-name">{org.name}</div>
                    <div className="org-slug">/{org.slug}</div>
                  </div>
                </div>
                <div className="org-meta">
                  <span className={`role-badge ${org.user_role}`}>{org.user_role}</span>
                  {data.currentOrganization?.id === org.id ? (
                    <span className="current-badge">Current</span>
                  ) : (
                    <button
                      className="switch-button"
                      onClick={() => handleSwitchOrganization(org.id)}
                    >
                      Switch
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-state">You are not a member of any organization yet. Create one to get started!</p>
        )}
      </div>

      {/* Selected Organization Details */}
      {selectedOrg && (
        <>
          <div className="admin-section">
            <h2>Organization Details</h2>
            <div className="org-detail-grid">
              <div className="detail-item">
                <label>Name</label>
                <span>{selectedOrg.organization.name}</span>
              </div>
              <div className="detail-item">
                <label>Slug</label>
                <span>{selectedOrg.organization.slug}</span>
              </div>
              <div className="detail-item">
                <label>Created</label>
                <span>{formatDate(selectedOrg.organization.created_at)}</span>
              </div>
              <div className="detail-item">
                <label>Members</label>
                <span>{selectedOrg.members.length}</span>
              </div>
            </div>
          </div>

          {/* Members Section */}
          <div className="admin-section">
            <div className="section-header">
              <h2>Members</h2>
            </div>

            {/* Add Member Form - only for admins */}
            {data?.currentOrganization && isOrgAdmin(data.currentOrganization) && (
              <div className="add-member-form">
                <form onSubmit={handleAddMember}>
                  <div className="form-row">
                    <input
                      type="email"
                      placeholder="Member email"
                      value={addMemberEmail}
                      onChange={(e) => setAddMemberEmail(e.target.value)}
                      className="search-input"
                      disabled={isAddingMember}
                    />
                    <select
                      value={addMemberRole}
                      onChange={(e) => setAddMemberRole(e.target.value)}
                      className="role-select"
                      disabled={isAddingMember}
                    >
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button
                      type="submit"
                      className="action-button"
                      disabled={isAddingMember}
                    >
                      {isAddingMember ? 'Adding...' : 'Add Member'}
                    </button>
                  </div>
                  {addMemberError && <p className="form-error">{addMemberError}</p>}
                </form>
              </div>
            )}

            <div className="users-table-container">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Role</th>
                    <th>Joined</th>
                    {data?.currentOrganization && isOrgAdmin(data.currentOrganization) && (
                      <th>Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {selectedOrg.members.map((member) => (
                    <tr key={member.id}>
                      <td className="user-cell">
                        <div className="user-info-cell">
                          <span className="user-avatar-small">
                            {member.name
                              ? member.name.charAt(0).toUpperCase()
                              : member.email.charAt(0).toUpperCase()}
                          </span>
                          <div>
                            <div className="user-name-cell">{member.name || '-'}</div>
                            <div className="user-email-cell">{member.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {editingMember === member.id ? (
                          <select
                            defaultValue={member.role}
                            className="role-select"
                            onChange={(e) =>
                              handleUpdateMemberRole(member.id, member.user_id, e.target.value)
                            }
                            disabled={member.user_id === selectedOrg.organization.owner_id}
                          >
                            <option value="admin">Admin</option>
                            <option value="member">Member</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        ) : (
                          <span className={`role-badge ${member.role}`}>
                            {member.role}
                            {member.user_id === selectedOrg.organization.owner_id && ' (Owner)'}
                          </span>
                        )}
                      </td>
                      <td>{formatDate(member.created_at)}</td>
                      {data?.currentOrganization && isOrgAdmin(data.currentOrganization) && (
                        <td className="actions-cell">
                          {actionLoading === member.user_id ? (
                            <LoadingSpinner size="small" />
                          ) : deleteConfirm === member.user_id ? (
                            <div className="delete-confirm">
                              <span>Remove?</span>
                              <button
                                className="confirm-yes"
                                onClick={() => handleRemoveMember(member.user_id)}
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
                          ) : editingMember === member.id ? (
                            <button
                              className="cancel-button"
                              onClick={() => setEditingMember(null)}
                            >
                              Done
                            </button>
                          ) : (
                            <div className="action-buttons">
                              <button
                                className="edit-button"
                                onClick={() => setEditingMember(member.id)}
                                title="Change role"
                                disabled={member.user_id === selectedOrg.organization.owner_id}
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              {member.user_id !== selectedOrg.organization.owner_id &&
                                member.user_id !== user?.id && (
                                  <button
                                    className="delete-button"
                                    onClick={() => setDeleteConfirm(member.user_id)}
                                    title="Remove member"
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
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default OrganizationSettings;
