'use client';

import * as React from 'react';
import Cal, { getCalApi } from '@calcom/embed-react';

interface CalEmbedProps {
  calLink?: string;
  styles?: React.CSSProperties;
}

export function CalEmbed({ calLink, styles }: CalEmbedProps) {
  const username = process.env.NEXT_PUBLIC_CAL_USERNAME;
  const eventType = process.env.NEXT_PUBLIC_CAL_EVENT_TYPE;
  const link = calLink || (username && eventType ? `${username}/${eventType}` : username);

  React.useEffect(() => {
    (async function () {
      const cal = await getCalApi();
      cal('ui', {
        theme: 'light',
        styles: { branding: { brandColor: '#2563eb' } },
      });
    })();
  }, []);

  if (!link) {
    return (
      <div className="p-8 text-center bg-slate-100 rounded-lg">
        <p className="text-slate-600">
          Scheduling is currently unavailable. Please contact us directly.
        </p>
      </div>
    );
  }

  return (
    <Cal
      calLink={link}
      style={{ width: '100%', height: '100%', overflow: 'scroll', minHeight: '700px', ...styles }}
      config={{ layout: 'month_view' }}
    />
  );
}
