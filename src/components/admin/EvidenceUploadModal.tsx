'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, FileText, CheckCircle, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getRequiredEvidenceForReasonCodes } from '@/lib/dispute-wizard-validation';

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
  clientId?: string;
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
  clientId,
}: EvidenceUploadModalProps) {
  const [dragActive, setDragActive] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = React.useState<Record<string, number>>({});
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
      alert(
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

  const getFileIcon = (fileName: string) => {
    if (fileName.match(/\.(pdf)$/i)) {
      return <FileText className="w-4 h-4 text-red-500" />;
    }
    if (fileName.match(/\.(doc|docx)$/i)) {
      return <FileText className="w-4 h-4 text-blue-500" />;
    }
    if (fileName.match(/\.(xls|xlsx)$/i)) {
      return <FileText className="w-4 h-4 text-green-500" />;
    }
    if (fileName.match(/\.(jpg|jpeg|png)$/i)) {
      return <FileText className="w-4 h-4 text-purple-500" />;
    }
    return <FileText className="w-4 h-4 text-gray-500" />;
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
                <Upload className="w-5 h-5 text-blue-500" />
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
                    <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
                      <p className="text-sm font-semibold text-red-900 dark:text-red-200 mb-2">
                        Required Evidence:
                      </p>
                      <ul className="space-y-1">
                        {evidenceRequirements.blockingRequired.map((item, idx) => (
                          <li key={idx} className="text-sm text-red-800 dark:text-red-300 flex items-start gap-2">
                            <span className="text-red-500 mt-0.5">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {evidenceRequirements.stronglyRecommended.length > 0 && (
                    <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900">
                      <p className="text-sm font-semibold text-yellow-900 dark:text-yellow-200 mb-2">
                        Strongly Recommended:
                      </p>
                      <ul className="space-y-1">
                        {evidenceRequirements.stronglyRecommended.map((item, idx) => (
                          <li key={idx} className="text-sm text-yellow-800 dark:text-yellow-300 flex items-start gap-2">
                            <span className="text-yellow-600 mt-0.5">•</span>
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
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                  : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/20'
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
                <Upload className={`w-8 h-8 ${dragActive ? 'text-blue-500' : 'text-gray-400'}`} />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {dragActive ? 'Drop files here' : 'Drag and drop files here'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    or{' '}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                      disabled={uploading}
                    >
                      click to browse
                    </button>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Supported formats: PDF, Word, Excel, Images, Text
                  </p>
                </div>
              </motion.div>
            </div>

            {/* Selected Files for Upload */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Files to Upload ({selectedFiles.length})
                </p>
                <div className="space-y-2">
                  {selectedFiles.map((file, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {getFileIcon(file.name)}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {(file.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(idx)}
                        className="p-1 hover:bg-blue-200 dark:hover:bg-blue-900 rounded transition-colors"
                        disabled={uploading}
                      >
                        <X className="w-4 h-4 text-gray-500" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Existing Documents */}
            {existingDocuments.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Uploaded Documents ({existingDocuments.length})
                </p>
                <div className="space-y-2">
                  {existingDocuments.map((doc) => (
                    <motion.div
                      key={doc.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {getFileIcon(doc.file_name)}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {doc.file_name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(doc.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      {onRemove && (
                        <button
                          onClick={() => handleRemoveExisting(doc.id)}
                          disabled={removingIds.has(doc.id)}
                          className="p-1 hover:bg-green-200 dark:hover:bg-green-900 rounded transition-colors ml-2"
                        >
                          {removingIds.has(doc.id) ? (
                            <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                          ) : (
                            <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-600" />
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
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900 dark:text-blue-200">
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
