'use client';

import * as React from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

type TeamRole = 'user' | 'staff' | 'admin' | 'super_admin';

interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: TeamRole;
  last_active_at: string | null;
  is_last_super_admin: boolean;
}

interface TeamActivity {
  id: string;
  action: string;
  subject_type: string;
  subject_id: string | null;
  actor_name: string | null;
  created_at: string;
}

type TeamState =
  | { kind: 'loading' }
  | { kind: 'forbidden' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; members: TeamMember[]; recentActivity: TeamActivity[] };

interface TeamManagerProps {
  currentUserId: string;
}

function isTeamRole(value: unknown): value is TeamRole {
  return value === 'user' || value === 'staff' || value === 'admin' || value === 'super_admin';
}

function parseMembers(value: unknown): TeamMember[] | null {
  if (!Array.isArray(value)) return null;

  const members = value.flatMap((member) => {
    if (typeof member !== 'object' || member === null) return [];
    if (!('id' in member) || !('email' in member) || !('name' in member) || !('role' in member) || !('is_last_super_admin' in member)) return [];
    if (typeof member.id !== 'string' || typeof member.email !== 'string' || typeof member.name !== 'string') return [];
    if (!isTeamRole(member.role) || typeof member.is_last_super_admin !== 'boolean') return [];

    return [{
      id: member.id,
      email: member.email,
      name: member.name,
      role: member.role,
      last_active_at: 'last_active_at' in member && typeof member.last_active_at === 'string' ? member.last_active_at : null,
      is_last_super_admin: member.is_last_super_admin,
    }];
  });

  return members.length === value.length ? members : null;
}

function parseActivity(value: unknown): TeamActivity[] | null {
  if (!Array.isArray(value)) return null;

  const activity = value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];
    if (!('id' in entry) || !('action' in entry) || !('subject_type' in entry) || !('created_at' in entry)) return [];
    if (typeof entry.id !== 'string' || typeof entry.action !== 'string' || typeof entry.subject_type !== 'string' || typeof entry.created_at !== 'string') return [];

    return [{
      id: entry.id,
      action: entry.action,
      subject_type: entry.subject_type,
      subject_id: 'subject_id' in entry && typeof entry.subject_id === 'string' ? entry.subject_id : null,
      actor_name: 'actor_name' in entry && typeof entry.actor_name === 'string' ? entry.actor_name : null,
      created_at: entry.created_at,
    }];
  });

  return activity.length === value.length ? activity : null;
}

function parseTeamPayload(value: unknown): { members: TeamMember[]; recentActivity: TeamActivity[] } | null {
  if (typeof value !== 'object' || value === null || !('members' in value) || !('recent_activity' in value)) return null;
  const members = parseMembers(value.members);
  const recentActivity = parseActivity(value.recent_activity);
  if (!members || !recentActivity) return null;
  return { members, recentActivity };
}

function formatActivityTime(value: string): string {
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? 'Unknown time' : timestamp.toLocaleString();
}

function roleUpdateErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'error' in error && error.error === 'last_super_admin') {
    return 'The final super admin cannot be demoted.';
  }
  return 'Unable to update this role. Please try again.';
}

export function TeamManager({ currentUserId }: TeamManagerProps) {
  const [state, setState] = React.useState<TeamState>({ kind: 'loading' });
  const [updatingMemberId, setUpdatingMemberId] = React.useState<string | null>(null);
  const [operationError, setOperationError] = React.useState<string | null>(null);

  const loadTeam = React.useCallback(async () => {
    setState({ kind: 'loading' });
    setOperationError(null);

    try {
      const response = await fetch('/api/admin/team');
      if (response.status === 403) {
        setState({ kind: 'forbidden' });
        return;
      }
      if (!response.ok) {
        setState({ kind: 'error', message: 'Unable to load team members.' });
        return;
      }

      const payload: unknown = await response.json();
      const parsed = parseTeamPayload(payload);
      if (!parsed) {
        setState({ kind: 'error', message: 'The team response was invalid.' });
        return;
      }

      setState({ kind: 'ready', ...parsed });
    } catch {
      setState({ kind: 'error', message: 'Unable to load team members.' });
    }
  }, []);

  React.useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  const updateRole = async (member: TeamMember, role: TeamRole) => {
    if (member.role === role) return;

    setUpdatingMemberId(member.id);
    setOperationError(null);
    try {
      const response = await fetch('/api/admin/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: member.id, role }),
      });
      if (!response.ok) {
        const error: unknown = await response.json();
        setOperationError(roleUpdateErrorMessage(error));
        return;
      }

      await loadTeam();
    } catch {
      setOperationError('Unable to update this role. Please try again.');
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleRoleSelection = (member: TeamMember, value: string) => {
    if (isTeamRole(value)) {
      void updateRole(member, value);
    }
  };

  if (state.kind === 'loading') {
    return <p className="text-sm text-muted-foreground">Loading team members…</p>;
  }

  if (state.kind === 'forbidden') {
    return <p className="text-sm text-destructive">You do not have permission to manage team roles.</p>;
  }

  if (state.kind === 'error') {
    return <p className="text-sm text-destructive">{state.message}</p>;
  }

  return (
    <div className="space-y-6">
      {operationError && <p role="alert" className="text-sm text-destructive">{operationError}</p>}

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Team members</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Last active</th>
              </tr>
            </thead>
            <tbody>
              {state.members.map((member) => {
                const isCurrentFinalOwner = member.id === currentUserId && member.is_last_super_admin;
                return (
                  <tr key={member.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3 align-top">
                      <p className="font-medium text-foreground">{member.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{member.email}</p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <select
                        aria-label={`Role for ${member.name}`}
                        className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                        value={member.role}
                        disabled={isCurrentFinalOwner || updatingMemberId === member.id}
                        onChange={(event) => handleRoleSelection(member, event.target.value)}
                      >
                        <option value="user">User</option>
                        <option value="staff">Staff</option>
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super admin</option>
                      </select>
                      {isCurrentFinalOwner && (
                        <p className="mt-1.5 text-xs text-muted-foreground">Final super admin — assign another owner first.</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {member.last_active_at ? formatActivityTime(member.last_active_at) : 'No recent session'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {state.recentActivity.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">No administrative activity has been recorded yet.</p>
          ) : state.recentActivity.map((activity) => (
            <div key={activity.id} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-foreground">{activity.action.replace('.', ' ')}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{activity.actor_name ?? 'System'}</p>
              </div>
              <time className="shrink-0 text-xs text-muted-foreground" dateTime={activity.created_at}>
                {formatActivityTime(activity.created_at)}
              </time>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
