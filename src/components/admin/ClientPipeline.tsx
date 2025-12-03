'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  GripVertical, 
  TrendingUp, 
  Clock, 
  ChevronRight,
  Loader2,
  Users
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { useAdminRole } from '@/contexts/AdminContext';

interface PipelineClient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  stage: string;
  assignedTo: string | null;
  assignedToName: string | null;
  latestScore: number | null;
  daysInStage: number;
}

interface PipelineData {
  stages: {
    lead: PipelineClient[];
    consultation: PipelineClient[];
    agreement: PipelineClient[];
    onboarding: PipelineClient[];
    active: PipelineClient[];
    completed: PipelineClient[];
  };
  counts: {
    lead: number;
    consultation: number;
    agreement: number;
    onboarding: number;
    active: number;
    completed: number;
    total: number;
  };
}

const STAGE_CONFIG = {
  lead: { label: 'Lead', color: 'bg-slate-500', textColor: 'text-slate-500', bgLight: 'bg-slate-500/10' },
  consultation: { label: 'Consultation', color: 'bg-blue-500', textColor: 'text-blue-500', bgLight: 'bg-blue-500/10' },
  agreement: { label: 'Agreement', color: 'bg-purple-500', textColor: 'text-purple-500', bgLight: 'bg-purple-500/10' },
  onboarding: { label: 'Onboarding', color: 'bg-orange-500', textColor: 'text-orange-500', bgLight: 'bg-orange-500/10' },
  active: { label: 'Active', color: 'bg-green-500', textColor: 'text-green-500', bgLight: 'bg-green-500/10' },
  completed: { label: 'Completed', color: 'bg-emerald-500', textColor: 'text-emerald-500', bgLight: 'bg-emerald-500/10' },
};

type StageKey = keyof typeof STAGE_CONFIG;

interface ClientCardProps {
  client: PipelineClient;
  onDragStart: (e: React.DragEvent, client: PipelineClient) => void;
}

function ClientCard({ client, onDragStart }: ClientCardProps) {
  const getScoreColor = (score: number | null) => {
    if (!score) return 'text-muted-foreground';
    if (score >= 700) return 'text-green-500';
    if (score >= 600) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      draggable
      onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, client)}
      className="group bg-card border border-border/50 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-secondary/50 hover:shadow-md transition-all"
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 text-muted-foreground/50 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex-1 min-w-0">
          <Link 
            href={`/admin/clients/${client.id}`}
            className="font-medium text-sm hover:text-secondary transition-colors truncate block"
          >
            {client.firstName} {client.lastName}
          </Link>
          <div className="flex items-center gap-2 mt-1">
            {client.latestScore && (
              <span className={`text-xs font-semibold ${getScoreColor(client.latestScore)}`}>
                {client.latestScore}
              </span>
            )}
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {client.daysInStage}d
            </span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-secondary transition-colors" />
      </div>
    </motion.div>
  );
}

interface StageColumnProps {
  stage: StageKey;
  clients: PipelineClient[];
  onDragStart: (e: React.DragEvent, client: PipelineClient) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, stage: StageKey) => void;
  isDragOver: boolean;
}

function StageColumn({ stage, clients, onDragStart, onDragOver, onDrop, isDragOver }: StageColumnProps) {
  const config = STAGE_CONFIG[stage];
  
  return (
    <div 
      className={`flex flex-col min-w-[200px] max-w-[220px] ${isDragOver ? 'ring-2 ring-secondary/50 rounded-lg' : ''}`}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, stage)}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${config.color}`} />
          <span className="text-sm font-medium">{config.label}</span>
        </div>
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${config.bgLight} ${config.textColor}`}>
          {clients.length}
        </span>
      </div>
      <div className={`flex-1 space-y-2 p-2 rounded-lg bg-muted/30 min-h-[200px] transition-colors ${isDragOver ? 'bg-secondary/10' : ''}`}>
        <AnimatePresence mode="popLayout">
          {clients.slice(0, 5).map((client) => (
            <ClientCard 
              key={client.id} 
              client={client} 
              onDragStart={onDragStart}
            />
          ))}
        </AnimatePresence>
        {clients.length > 5 && (
          <div className="text-center py-2">
            <span className="text-xs text-muted-foreground">
              +{clients.length - 5} more
            </span>
          </div>
        )}
        {clients.length === 0 && (
          <div className="flex items-center justify-center h-[100px] text-muted-foreground/50">
            <span className="text-xs">No clients</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ClientPipeline() {
  const [pipeline, setPipeline] = React.useState<PipelineData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [draggedClient, setDraggedClient] = React.useState<PipelineClient | null>(null);
  const [dragOverStage, setDragOverStage] = React.useState<StageKey | null>(null);

  React.useEffect(() => {
    fetchPipeline();
  }, []);

  async function fetchPipeline() {
    try {
      const response = await fetch('/api/admin/dashboard/pipeline');
      if (response.ok) {
        const data = await response.json();
        setPipeline(data);
      }
    } catch (error) {
      console.error('Error fetching pipeline:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleDragStart = (e: React.DragEvent, client: PipelineClient) => {
    setDraggedClient(client);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (stage: StageKey) => {
    setDragOverStage(stage);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = async (e: React.DragEvent, newStage: StageKey) => {
    e.preventDefault();
    setDragOverStage(null);

    if (!draggedClient || draggedClient.stage === newStage) {
      setDraggedClient(null);
      return;
    }

    // Optimistic update
    if (pipeline) {
      const oldStage = draggedClient.stage as StageKey;
      const updatedPipeline = { ...pipeline };
      
      // Remove from old stage
      updatedPipeline.stages[oldStage] = updatedPipeline.stages[oldStage].filter(
        c => c.id !== draggedClient.id
      );
      updatedPipeline.counts[oldStage]--;
      
      // Add to new stage
      const updatedClient = { ...draggedClient, stage: newStage, daysInStage: 0 };
      updatedPipeline.stages[newStage] = [updatedClient, ...updatedPipeline.stages[newStage]];
      updatedPipeline.counts[newStage]++;
      
      setPipeline(updatedPipeline);
    }

    // Update on server
    try {
      await fetch('/api/admin/dashboard/pipeline', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: draggedClient.id,
          newStage: newStage,
        }),
      });
    } catch (error) {
      console.error('Error updating client stage:', error);
      // Revert on error
      fetchPipeline();
    }

    setDraggedClient(null);
  };

  if (loading) {
    return (
      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-serif flex items-center gap-2">
            <Users className="w-5 h-5 text-secondary" />
            Client Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!pipeline) {
    return null;
  }

  const stages: StageKey[] = ['lead', 'consultation', 'agreement', 'onboarding', 'active', 'completed'];

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-serif flex items-center gap-2">
              <Users className="w-5 h-5 text-secondary" />
              Client Pipeline
            </CardTitle>
            <CardDescription>
              Drag clients between stages • {pipeline.counts.total} total clients
            </CardDescription>
          </div>
          <Link 
            href="/admin/clients"
            className="text-sm text-muted-foreground hover:text-secondary transition-colors flex items-center gap-1"
          >
            View all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div 
          className="flex gap-3 overflow-x-auto pb-2"
          onDragLeave={handleDragLeave}
        >
          {stages.map((stage) => (
            <div
              key={stage}
              onDragEnter={() => handleDragEnter(stage)}
            >
              <StageColumn
                stage={stage}
                clients={pipeline.stages[stage]}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                isDragOver={dragOverStage === stage}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
