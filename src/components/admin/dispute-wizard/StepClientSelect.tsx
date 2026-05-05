'use client';

import * as React from 'react';
import { Search, Check, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useWizardContext } from './WizardContext';

export function StepClientSelect() {
  const {
    clients, selectedClient, clientSearch, setClientSearch, loadingClients,
    handleSelectClient, renderValidationMessages,
  } = useWizardContext();

  return (
    <Card className="bg-card border border-border">
      <CardHeader>
        <CardTitle>
          Select Client
          <span className="text-red-600 dark:text-red-400 ml-1">*</span>
          {!selectedClient && (
            <span className="text-xs text-red-600 dark:text-red-400 ml-3 font-normal">(Required)</span>
          )}
        </CardTitle>
        <CardDescription>Choose a client to generate dispute letters for</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {renderValidationMessages()}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search clients by name or email..."
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {loadingClients ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-secondary" />
          </div>
        ) : (
          <div className="grid gap-3 max-h-[400px] overflow-y-auto">
            {clients.map((client) => {
              const firstName = typeof client.first_name === 'string' ? client.first_name.trim() : '';
              const lastName = typeof client.last_name === 'string' ? client.last_name.trim() : '';
              const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.trim() || '?';
              const fullName = `${firstName} ${lastName}`.trim() || 'Unknown Client';

              return (
                <div
                  key={client.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedClient?.id === client.id
                      ? 'border-secondary bg-secondary/10'
                      : 'border-border hover:border-secondary/50'
                  }`}
                  onClick={() => handleSelectClient(client)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-secondary/70 flex items-center justify-center text-primary font-bold">
                      {initials}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{fullName}</p>
                      <p className="text-sm text-muted-foreground">{client.email || '—'}</p>
                    </div>
                    {selectedClient?.id === client.id && (
                      <Check className="w-5 h-5 text-secondary" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
