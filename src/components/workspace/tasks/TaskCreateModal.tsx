'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';

interface Task {
  id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string | null;
  visible_to_client: boolean;
  is_blocking: boolean;
}

interface Client {
  id: string;
  first_name: string;
  last_name: string;
}

interface TaskCreateModalProps {
  open: boolean;
  editingTask: Task | null;
  clients: Client[];
  onClose: () => void;
  onSaved: () => void;
}

export function TaskCreateModal({ open, editingTask, clients, onClose, onSaved }: TaskCreateModalProps) {
  const [form, setForm] = React.useState({
    title: '',
    description: '',
    client_id: '',
    priority: 'medium',
    due_date: '',
    status: 'todo',
    visible_to_client: false,
    is_blocking: false,
  });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (editingTask) {
      setForm({
        title: editingTask.title,
        description: editingTask.description || '',
        client_id: editingTask.client_id || '',
        priority: editingTask.priority,
        due_date: editingTask.due_date?.split('T')[0] || '',
        status: editingTask.status,
        visible_to_client: editingTask.visible_to_client,
        is_blocking: editingTask.is_blocking,
      });
    } else {
      setForm({
        title: '',
        description: '',
        client_id: '',
        priority: 'medium',
        due_date: '',
        status: 'todo',
        visible_to_client: false,
        is_blocking: false,
      });
    }
  }, [editingTask, open]);

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }

    setSaving(true);
    try {
      const method = editingTask ? 'PUT' : 'POST';
      const url = editingTask ? `/api/admin/tasks/${editingTask.id}` : '/api/admin/tasks';
      const body = editingTask
        ? {
            title: form.title,
            description: form.description,
            client_id: form.client_id || null,
            status: form.status,
            priority: form.priority,
            due_date: form.due_date || null,
            visible_to_client: form.visible_to_client,
            is_blocking: form.is_blocking,
          }
        : {
            ...form,
            client_id: form.client_id || null,
            due_date: form.due_date || null,
          };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        onClose();
        onSaved();
      }
    } catch (error) {
      console.error('Error saving task:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const isEdit = !!editingTask;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md"
      >
        <Card className="bg-card border-border shadow-2xl">
          <CardHeader>
            <CardTitle>{isEdit ? 'Edit Task' : 'Add New Task'}</CardTitle>
            <CardDescription>{isEdit ? 'Update task details.' : 'Create a new task to track.'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title *</label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Task title"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Task description..."
                className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Client</label>
              <select
                value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="">No client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {isEdit && (
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as Task['status'] })}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="done">Done</option>
                  </select>
                </div>
              )}
              <div>
                <label className="text-sm font-medium">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Due Date</label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Client Portal</label>
              <div className="flex flex-col gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.visible_to_client}
                    onChange={(e) => setForm({ ...form, visible_to_client: e.target.checked })}
                    className="h-4 w-4 rounded border border-input"
                  />
                  <span>Show this task in the client portal</span>
                </label>
                <label className="flex items-center gap-2 pl-6">
                  <input
                    type="checkbox"
                    checked={form.is_blocking}
                    onChange={(e) => setForm({ ...form, is_blocking: e.target.checked })}
                    className="h-4 w-4 rounded border border-input"
                  />
                  <span>Required before starting next dispute round</span>
                </label>
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {isEdit ? 'Save Changes' : 'Add Task'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
