'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FileUp, Upload, FileText } from 'lucide-react';
import type { Document } from '@/components/portal/types';

interface PortalDocumentsProps {
  documents: Document[];
  onUpload: () => void;
}

export default function PortalDocuments({ documents, onUpload }: PortalDocumentsProps) {
  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="font-sans text-xl flex items-center gap-2">
            <FileUp className="w-5 h-5 text-secondary" />
            Documents
          </CardTitle>
          <CardDescription>
            Your uploaded documents and correspondence
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onUpload}
        >
          <Upload className="w-4 h-4 mr-1" />
          Upload
        </Button>
      </CardHeader>
      <CardContent>
        {documents.length > 0 ? (
          <div className="space-y-3">
            {documents.slice(0, 5).map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <FileText className="w-5 h-5 text-secondary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{doc.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <FileUp className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-muted-foreground">No documents yet.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={onUpload}
            >
              <Upload className="w-4 h-4 mr-1" />
              Upload Your First Document
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
