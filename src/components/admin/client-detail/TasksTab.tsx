'use client';

import * as React from 'react';
import {
  CheckSquare,
  Plus,
  Loader2,
  Trash2,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { Task } from './types';
import { isTaskOverdue } from './types';
import { getPriorityColor } from '@/lib/dispute-utils';

interface TasksTabProps {
  clientId: string;
  tasks: Task[];
  onTasksChanged: () => void;
}

export function TasksTab({ clientId, tasks, onTasksChanged }: TasksTabProps) {
  const [showAddTaskModal, setShowAddTaskModal] = React.useState(false);
  const [newTask, setNewTask] = React.useState({
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
  });
  const [addingTask, setAddingTask] = React.useState(false);
  const [pendingDeleteTaskId, setPendingDeleteTaskId] = React.useState<string | null>(null);

  const handleAddTask = async () => {
    if (!newTask.title.trim()) return;
    setAddingTask(true);
    try {
      const response = await fetch('/api/admin/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          title: newTask.title,
          description: newTask.description || null,
          priority: newTask.priority,
          due_date: newTask.due_date || null,
        }),
      });
      if (response.ok) {
        setNewTask({ title: '', description: '', priority: 'medium', due_date: '' });
        setShowAddTaskModal(false);
        onTasksChanged();
      }
    } catch (error) {
      console.error('Error adding task:', error);
    } finally {
      setAddingTask(false);
    }
  };

  const handleTaskStatusChange = async (taskId: string, newStatus: string) => {
    try {
      await fetch(`/api/admin/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      onTasksChanged();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const confirmDeleteTask = async () => {
    if (!pendingDeleteTaskId) return;
    try {
      await fetch(`/api/admin/tasks/${pendingDeleteTaskId}`, { method: 'DELETE' });
      onTasksChanged();
    } catch (error) {
      console.error('Error deleting task:', error);
    } finally {
      setPendingDeleteTaskId(null);
    }
  };

  return (
    <>
      <Card className="bg-card border border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-blue-500" />
              Tasks
            </CardTitle>
            <CardDescription>{tasks.length} task(s) for this client</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowAddTaskModal(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Add Task
          </Button>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No tasks for this client yet.</p>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className={`p-3 rounded-lg bg-muted/50 ${isTaskOverdue(task.due_date, task.status) ? 'border border-red-500/30' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>{task.title}</p>
                      {task.description && <p className="text-xs text-muted-foreground mt-1 truncate">{task.description}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${getPriorityColor(task.priority)}`}>{task.priority}</span>
                        {task.due_date && (
                          <span className={`text-xs flex items-center gap-1 ${isTaskOverdue(task.due_date, task.status) ? 'text-red-500' : 'text-muted-foreground'}`}>
                            <Clock className="w-3 h-3" />
                            {new Date(task.due_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={task.status} onChange={(e) => handleTaskStatusChange(task.id, e.target.value)} className="h-7 px-2 text-xs rounded border border-input bg-background">
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="review">Review</option>
                        <option value="done">Done</option>
                      </select>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setPendingDeleteTaskId(task.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showAddTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowAddTaskModal(false)}>
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <Card className="bg-card border-border shadow-2xl">
              <CardHeader>
                <CardTitle>Add Task</CardTitle>
                <CardDescription>Create a new task for this client.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Title *</label>
                  <Input value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="Task title" />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <textarea value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} placeholder="Task description..." className="w-full min-h-[60px] px-3 py-2 text-sm rounded-md border border-input bg-background" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Priority</label>
                    <select value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Due Date</label>
                    <Input type="date" value={newTask.due_date} onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })} />
                  </div>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setShowAddTaskModal(false)}>Cancel</Button>
                  <Button className="flex-1" onClick={handleAddTask} disabled={addingTask || !newTask.title.trim()}>
                    {addingTask && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Add Task
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingDeleteTaskId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteTaskId(null); }}
        title="Delete Task"
        description="Delete this task?"
        confirmLabel="Delete"
        onConfirm={confirmDeleteTask}
        variant="danger"
      />
    </>
  );
}
