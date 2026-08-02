import Link from 'next/link';
import { FileText, Settings, Database } from 'lucide-react';
import { AdminPageHeader } from '@/components/workspace/AdminPageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { requireCapability } from '@/lib/admin-session';

const destinations = [
  { href: '/admin/letter-library', label: 'Letter Library', description: 'Manage generation strategies, prompt context, citations, and effectiveness.', icon: FileText },
  { href: '/admin/content', label: 'Content', description: 'Manage public pages and editorial content.', icon: Database },
  { href: '/admin/settings', label: 'Settings', description: 'Manage system configuration and provider settings.', icon: Settings },
];

export default async function AdminIndexPage() {
  const teamManager = await requireCapability('team:manage');
  const availableDestinations = teamManager
    ? [...destinations, { href: '/admin/team', label: 'Team & Roles', description: 'Manage workspace access and review administrative activity.', icon: Settings }]
    : destinations;

  return (
    <div className="space-y-6">
      <AdminPageHeader eyebrow="Administration" title="Administration" description="Business configuration for the Top Tier workspace." />
      <div className="grid gap-4 md:grid-cols-3">
        {availableDestinations.map(({ href, label, description, icon: Icon }) => (
          <Link key={href} href={href} className="group">
            <Card className="h-full transition-colors group-hover:border-secondary/50">
              <CardHeader><Icon className="h-5 w-5 text-secondary" /><CardTitle className="mt-2">{label}</CardTitle></CardHeader>
              <CardContent className="text-sm leading-6 text-muted-foreground">{description}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
