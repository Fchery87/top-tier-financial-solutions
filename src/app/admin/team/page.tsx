import { redirect } from 'next/navigation';

import { TeamManager } from '@/components/workspace/team/TeamManager';
import { AdminPageHeader } from '@/components/workspace/AdminPageHeader';
import { requireCapability } from '@/lib/admin-session';

export default async function TeamPage() {
  const adminUser = await requireCapability('team:manage');
  if (!adminUser) {
    redirect('/admin');
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Administration"
        title="Team & Roles"
        description="Manage workspace access and review recent administrative changes."
      />
      <TeamManager currentUserId={adminUser.id} />
    </div>
  );
}
