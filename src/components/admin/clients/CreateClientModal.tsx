'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { X, Upload, Loader2, FileImage } from 'lucide-react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
];

const DOCUMENT_TYPES = [
  { value: 'government_id', label: 'Government ID (License/Passport)' },
  { value: 'ssn_card', label: 'Social Security Card' },
  { value: 'proof_of_address', label: 'Proof of Address (Utility Bill)' },
  { value: 'other', label: 'Other Document' },
];

interface CreateClientModalProps {
  open: boolean;
  onClose: () => void;
  onClientCreated: () => void;
}

export function CreateClientModal({ open, onClose, onClientCreated }: CreateClientModalProps) {
  const [newClient, setNewClient] = React.useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    street_address: '',
    city: '',
    state: '',
    zip_code: '',
    date_of_birth: '',
    ssn_last_4: '',
    notes: '',
  });
  const [pendingDocuments, setPendingDocuments] = React.useState<Array<{
    file: File;
    type: string;
    preview?: string;
  }>>([]);
  const [saving, setSaving] = React.useState(false);

  const resetForm = () => {
    setNewClient({
      first_name: '', last_name: '', email: '', phone: '',
      street_address: '', city: '', state: '', zip_code: '',
      date_of_birth: '', ssn_last_4: '', notes: '',
    });
    setPendingDocuments([]);
  };

  const handleAddClient = async () => {
    if (!newClient.first_name || !newClient.last_name || !newClient.email) {
      toast.error('Please fill in required fields');
      return;
    }

    if (newClient.ssn_last_4 && !/^\d{4}$/.test(newClient.ssn_last_4)) {
      toast.error('SSN last 4 must be exactly 4 digits');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClient),
      });

      if (response.ok) {
        const clientData = await response.json();

        if (pendingDocuments.length > 0) {
          for (const doc of pendingDocuments) {
            const formData = new FormData();
            formData.append('file', doc.file);
            formData.append('client_id', clientData.id);
            formData.append('document_type', doc.type);

            await fetch('/api/admin/clients/documents', {
              method: 'POST',
              body: formData,
            });
          }
        }

        onClose();
        resetForm();
        onClientCreated();
      }
    } catch (error) {
      console.error('Error adding client:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const files = e.target.files;
    if (!files) return;

    const newDocs = Array.from(files).map(file => ({
      file,
      type: docType,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));

    setPendingDocuments(prev => [...prev, ...newDocs]);
    e.target.value = '';
  };

  const removeDocument = (index: number) => {
    setPendingDocuments(prev => {
      const doc = prev[index];
      if (doc.preview) URL.revokeObjectURL(doc.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
      onClick={() => { onClose(); setPendingDocuments([]); }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl my-8"
      >
        <Card className="bg-card border-border shadow-2xl max-h-[90vh] overflow-y-auto">
          <CardHeader>
            <CardTitle>Add New Client</CardTitle>
            <CardDescription>Enter client information to create a new record.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">First Name *</label>
                  <Input
                    value={newClient.first_name}
                    onChange={(e) => setNewClient({ ...newClient, first_name: e.target.value })}
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Last Name *</label>
                  <Input
                    value={newClient.last_name}
                    onChange={(e) => setNewClient({ ...newClient, last_name: e.target.value })}
                    placeholder="Doe"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="text-sm font-medium">Email *</label>
                  <Input
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Phone</label>
                  <Input
                    value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Address</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Street Address</label>
                  <Input
                    value={newClient.street_address}
                    onChange={(e) => setNewClient({ ...newClient, street_address: e.target.value })}
                    placeholder="123 Main St, Apt 4B"
                  />
                </div>
                <div className="grid grid-cols-6 gap-4">
                  <div className="col-span-3">
                    <label className="text-sm font-medium">City</label>
                    <Input
                      value={newClient.city}
                      onChange={(e) => setNewClient({ ...newClient, city: e.target.value })}
                      placeholder="New York"
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="text-sm font-medium">State</label>
                    <select
                      value={newClient.state}
                      onChange={(e) => setNewClient({ ...newClient, state: e.target.value })}
                      className="w-full h-10 px-3 py-2 text-sm rounded-md border border-input bg-background"
                    >
                      <option value="">--</option>
                      {US_STATES.map((state) => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium">ZIP Code</label>
                    <Input
                      value={newClient.zip_code}
                      onChange={(e) => setNewClient({ ...newClient, zip_code: e.target.value })}
                      placeholder="10001"
                      maxLength={10}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Personal Identification</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Date of Birth</label>
                  <Input
                    type="date"
                    value={newClient.date_of_birth}
                    onChange={(e) => setNewClient({ ...newClient, date_of_birth: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">SSN (Last 4 digits)</label>
                  <Input
                    value={newClient.ssn_last_4}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setNewClient({ ...newClient, ssn_last_4: val });
                    }}
                    placeholder="1234"
                    maxLength={4}
                  />
                  <p className="text-xs text-muted-foreground mt-1">For verification purposes only</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Identity Documents</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Upload copies of ID, SSN card, and proof of address (required for credit dispute letters)
              </p>

              <div className="grid grid-cols-2 gap-3">
                {DOCUMENT_TYPES.map((docType) => (
                  <label
                    key={docType.value}
                    className="flex items-center gap-3 p-3 border border-dashed border-border rounded-lg cursor-pointer hover:border-secondary/50 transition-colors"
                  >
                    <Upload className="w-5 h-5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{docType.label}</p>
                      <p className="text-xs text-muted-foreground">Click to upload</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e, docType.value)}
                    />
                  </label>
                ))}
              </div>

              {pendingDocuments.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium">Pending uploads ({pendingDocuments.length})</p>
                  {pendingDocuments.map((doc, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg"
                    >
                      {doc.preview ? (
                        <Image
                          src={doc.preview}
                          alt=""
                          width={40}
                          height={40}
                          unoptimized
                          className="w-10 h-10 object-cover rounded"
                        />
                      ) : (
                        <FileImage className="w-10 h-10 p-2 text-muted-foreground" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{doc.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {DOCUMENT_TYPES.find(t => t.value === doc.type)?.label}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeDocument(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium">Notes</label>
              <textarea
                value={newClient.notes}
                onChange={(e) => setNewClient({ ...newClient, notes: e.target.value })}
                placeholder="Additional notes..."
                className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => { onClose(); setPendingDocuments([]); }}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleAddClient} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Add Client
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
