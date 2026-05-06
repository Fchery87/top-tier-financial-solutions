'use client';

import { FileCheck2, LockKeyhole, Shield } from 'lucide-react';

interface PortalHeaderProps {
  userName: string;
}

export default function PortalHeader({ userName }: PortalHeaderProps) {
  return (
    <section className="platform-shell relative pt-28 pb-10 md:pt-32 md:pb-12">
      <div className="absolute inset-0 rule-grid opacity-25" />
      <div className="container relative mx-auto px-4 md:px-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-border bg-card/70 px-3 py-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4 text-secondary" />
              Secure client workspace
            </div>
            <h1 className="font-display text-4xl leading-tight tracking-[-0.04em] text-foreground md:text-6xl">
              Welcome back, <span className="text-secondary">{userName}</span>
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
              Follow your current phase, complete required tasks, approve documents, and review progress without sorting through internal operations data.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:w-[26rem]">
            <div className="surface-panel rounded-lg p-4">
              <LockKeyhole className="h-5 w-5 text-secondary" />
              <p className="mt-3 text-sm font-semibold">Private by default</p>
              <p className="mt-1 text-xs text-muted-foreground">Your reports and documents stay behind authenticated access.</p>
            </div>
            <div className="surface-panel rounded-lg p-4">
              <FileCheck2 className="h-5 w-5 text-secondary" />
              <p className="mt-3 text-sm font-semibold">Action-led</p>
              <p className="mt-1 text-xs text-muted-foreground">Open tasks and approvals are surfaced before everything else.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
