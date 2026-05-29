'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Upload, X, FileText, CheckCircle, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getRequiredEvidenceForReasonCodes } from '@/lib/dispute-wizard-validation';
import { toast } from 'sonner';

export interface EvidenceDocument {
  id: string;
  file_name: string;
  file_type: string;
  file_url: string;
  created_at: string;
}

interface EvidenceUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (files: File[]) => Promise<void>;
  onRemove?: (documentId: string) => Promise<void>;
  reasonCodes: string[];
  existingDocuments: EvidenceDocument[];
  isLoading?: boolean;
}

/**
 * Modal for uploading evidence documents with drag-and-drop
 * Shows required evidence checklist based on reason codes
 */
export function EvidenceUploadModal({
  isOpen,
  onClose,
  onUpload,
  onRemove,
  reasonCodes,
  existingDocuments,
  isLoading = false,
}: EvidenceUploadModalProps) {
  const [dragActive, setDragActive] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
  const [removingIds, setRemovingIds] = React.useState<Set<string>>(new Set());
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const evidenceRequirements = React.useMemo(
    () => getRequiredEvidenceForReasonCodes(reasonCodes),
    [reasonCodes]
  );

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelection(files);
    }
  };

  const handleFileSelection = (files: File[]) => {
    // Filter to only document types
    const validFiles = files.filter((file) => {
      const validTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/jpeg',
        'image/png',
        'text/plain',
      ];
      return validTypes.includes(file.type) || file.name.match(/\.(pdf|doc|docx|xls|xlsx|jpg|jpeg|png|txt)$/i);
    });

    if (validFiles.length !== files.length) {
      toast.error(
        `Some files were skipped. Only PDF, Word, Excel, images, and text files are supported.`
      );
    }

    setSelectedFiles((prev) => [...prev, ...validFiles]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFileSelection(files);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    try {
      await onUpload(selectedFiles);
      setSelectedFiles([]);
    } catch (error) {
      console.error('Error uploading files:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveExisting = async (documentId: string) => {
    if (!onRemove) return;

    setRemovingIds((prev) => new Set(prev).add(documentId));
    try {
      await onRemove(documentId);
    } catch (error) {
      console.error('Error removing document:', error);
    } finally {
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(documentId);
        return next;
      });
    }
  };

  const getFileIcon = (_fileName: string) => {
    return <FileText className="w-4 h-4 text-muted-foreground" />;
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="bg-card border-border/50">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-secondary" />
                Upload Evidence Documents
              </CardTitle>
              <CardDescription>
                {reasonCodes.length > 0
                  ? `Add supporting documents for your dispute reasons`
                  : 'Upload evidence to strengthen your dispute'}
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Evidence Requirements Checklist */}
            {reasonCodes.length > 0 && (
              <div className="space-y-3">
                <div className="space-y-2">
                  {evidenceRequirements.blockingRequired.length > 0 && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <p className="text-sm font-semibold text-destructive mb-2">
                        Required Evidence:
                      </p>
                      <ul className="space-y-1">
                        {evidenceRequirements.blockingRequired.map((item, idx) => (
                          <li key={idx} className="text-sm text-destructive flex items-start gap-2">
                            <span className="text-destructive mt-0.5">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {evidenceRequirements.stronglyRecommended.length > 0 && (
                    <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                      <p className="text-sm font-semibold text-warning mb-2">
                        Strongly Recommended:
                      </p>
                      <ul className="space-y-1">
                        {evidenceRequirements.stronglyRecommended.map((item, idx) => (
                          <li key={idx} className="text-sm text-warning flex items-start gap-2">
                            <span className="text-warning mt-0.5">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Drag and Drop Area */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                dragActive
                  ? 'border-secondary bg-secondary/10'
                  : 'border-border bg-muted/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleInputChange}
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt"
                disabled={uploading}
              />
              <motion.div
                animate={{ scale: dragActive ? 1.05 : 1 }}
                className="flex flex-col items-center gap-3"
              >
                <Upload className={`w-8 h-8 ${dragActive ? 'text-secondary' : 'text-muted-foreground'}`} />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {dragActive ? 'Drop files here' : 'Drag and drop files here'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    or{' '}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-secondary hover:underline"
                      disabled={uploading}
                    >
                      click to browse
                    </button>
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Supported formats: PDF, Word, Excel, Images, Text
                  </p>
                </div>
              </motion.div>
            </div>

            {/* Selected Files for Upload */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Files to Upload ({selectedFiles.length})
                </p>
                <div className="space-y-2">
                  {selectedFiles.map((file, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="flex items-center justify-between p-3 bg-secondary/10 border border-secondary/20 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {getFileIcon(file.name)}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(idx)}
                        className="p-1 hover:bg-secondary/20 rounded transition-colors"
                        disabled={uploading}
                      >
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Existing Documents */}
            {existingDocuments.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Uploaded Documents ({existingDocuments.length})
                </p>
                <div className="space-y-2">
                  {existingDocuments.map((doc) => (
                    <motion.div
                      key={doc.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between p-3 bg-success/10 border border-success/20 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {getFileIcon(doc.file_name)}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground truncate">
                            {doc.file_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(doc.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <CheckCircle className="w-5 h-5 text-success" />
                      </div>
                      {onRemove && (
                        <button
                          onClick={() => handleRemoveExisting(doc.id)}
                          disabled={removingIds.has(doc.id)}
                          className="p-1 hover:bg-success/20 rounded transition-colors ml-2"
                        >
                          {removingIds.has(doc.id) ? (
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          ) : (
                            <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                          )}
                        </button>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Info Box */}
            {existingDocuments.length === 0 && selectedFiles.length === 0 && (
              <div className="p-3 rounded-lg bg-secondary/10 border border-secondary/20 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
                <div className="text-sm text-foreground">
                  {reasonCodes.length > 0
                    ? 'Evidence significantly strengthens your dispute. Upload any supporting documents before proceeding.'
                    : 'Upload evidence documents to support your dispute claim.'}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={onClose} disabled={uploading}>
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={selectedFiles.length === 0 || uploading || isLoading}
              >
                {uploading || isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload {selectedFiles.length} File{selectedFiles.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
