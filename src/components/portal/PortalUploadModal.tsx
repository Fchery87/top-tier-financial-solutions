'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FileText, Upload, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface PortalUploadModalProps {
  open: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
}

export default function PortalUploadModal({ open, onClose, onUploadComplete }: PortalUploadModalProps) {
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [uploadFileType, setUploadFileType] = React.useState('credit_report');
  const [uploadNotes, setUploadNotes] = React.useState('');
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = [
        'application/pdf',
        'text/html',
        'text/plain',
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Please upload a PDF, HTML, TXT, image, or Word document.');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File too large. Maximum size is 10MB.');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('file_type', uploadFileType);
      formData.append('notes', uploadNotes);

      const response = await fetch('/api/portal/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setSelectedFile(null);
        setUploadFileType('credit_report');
        setUploadNotes('');
        onClose();
        onUploadComplete();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading:', error);
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setSelectedFile(null);
    setUploadNotes('');
    setUploadFileType('credit_report');
  };

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={() => { onClose(); reset(); }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md"
      >
        <Card className="bg-card border-border shadow-2xl">
          <CardHeader>
            <CardTitle className="font-serif">Upload Document</CardTitle>
            <CardDescription>
              Upload credit reports, ID documents, or correspondence for your case.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Document Type</label>
              <select
                value={uploadFileType}
                onChange={(e) => setUploadFileType(e.target.value)}
                className="w-full h-10 px-3 mt-1 rounded-md border border-input bg-background text-sm"
              >
                <option value="credit_report">Credit Report</option>
                <option value="id_document">ID Document</option>
                <option value="dispute_letter">Dispute Letter</option>
                <option value="correspondence">Bureau Correspondence</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">File</label>
              <div
                className="mt-1 border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-secondary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {selectedFile ? (
                  <div>
                    <FileText className="w-8 h-8 mx-auto mb-2 text-secondary" />
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Click to select a file</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF, HTML, TXT, images, or Word docs (max 10MB)
                    </p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.html,.htm,.txt,.jpg,.jpeg,.png,.gif,.doc,.docx"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Notes (Optional)</label>
              <textarea
                value={uploadNotes}
                onChange={(e) => setUploadNotes(e.target.value)}
                placeholder="Add any notes about this document..."
                className="w-full min-h-[60px] mt-1 px-3 py-2 text-sm rounded-md border border-input bg-background"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { onClose(); reset(); }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/90"
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Upload
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
