'use client';

import * as React from 'react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import {
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/admin/DataTable';
import { Pagination } from '@/components/admin/Pagination';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatDate } from '@/lib/format';
import { getPriorityColor } from '@/lib/dispute-utils';
import { TaskStatsCards } from '@/components/admin/tasks/TaskStatsCards';
import { TaskFilters } from '@/components/admin/tasks/TaskFilters';
import { TaskCreateModal } from '@/components/admin/tasks/TaskCreateModal';

interface Task {
  id: string;
  client_id: string | null;
  assignee_id: string | null;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  client_name: string | null;
  assignee_name: string | null;
  visible_to_client: boolean;
  is_blocking: boolean;
}

interface Client {
  id: string;
  first_name: string;
  last_name: string;
}

const statusOptions = [
  { value: 'all', label: 'All Status' },
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
];

const priorityOptions = [
  { value: 'all', label: 'All Priority' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export default function TasksPage() {
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedStatus, setSelectedStatus] = React.useState('all');
  const [selectedPriority, setSelectedPriority] = React.useState('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [totalItems, setTotalItems] = React.useState(0);
  const [itemsPerPage, setItemsPerPage] = React.useState(20);
  const [sortConfig, setSortConfig] = React.useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'created_at',
    direction: 'desc',
  });

  const [showAddModal, setShowAddModal] = React.useState(false);
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const fetchTasks = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString(),
        sort_by: sortConfig.key,
        sort_order: sortConfig.direction,
      });

      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      if (selectedPriority !== 'all') params.append('priority', selectedPriority);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/api/admin/tasks?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTasks(data.items);
        setTotalItems(data.total);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  }, [page, itemsPerPage, selectedStatus, selectedPriority, searchQuery, sortConfig]);

  const fetchClients = React.useCallback(async () => {
    try {
      const response = await fetch('/api/admin/clients?limit=100');
      if (response.ok) {
        const data = await response.json();
        setClients(data.items);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  }, []);

  React.useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  React.useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleDeleteTask = (id: string) => {
    setPendingDeleteId(id);
  };

  const confirmDeleteTask = async () => {
    if (!pendingDeleteId) return;
    try {
      const response = await fetch(`/api/admin/tasks/${pendingDeleteId}`, { method: 'DELETE' });
      if (response.ok) {
        fetchTasks();
      }
    } catch (error) {
      console.error('Error deleting task:', error);
    } finally {
      setPendingDeleteId(null);
    }
  };

  const handleStatusChange = async (task: Task, newStatus: string) => {
    try {
      await fetch(`/api/admin/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchTasks();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const isOverdue = (dueDate: string | null, status: string) => {
    if (!dueDate || status === 'done') return false;
    return new Date(dueDate) < new Date();
  };

  const columns = [
    {
      key: 'title',
      header: 'Task',
      sortable: true,
      render: (item: Task) => (
        <div className="max-w-md">
          <p className="font-medium truncate">{item.title}</p>
          {item.description && (
            <p className="text-xs text-muted-foreground truncate">{item.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'client',
      header: 'Client',
      render: (item: Task) => (
        <span className="text-sm">{item.client_name || '—'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (item: Task) => (
        <select
          value={item.status}
          onChange={(e) => handleStatusChange(item, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="h-8 px-2 text-xs rounded-md border border-input bg-background"
        >
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="review">Review</option>
          <option value="done">Done</option>
        </select>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      render: (item: Task) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getPriorityColor(item.priority)}`}>
          {item.priority}
        </span>
      ),
    },
    {
      key: 'client_view',
      header: 'Client View',
      render: (item: Task) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            item.visible_to_client
              ? item.is_blocking
                ? 'bg-destructive/10 text-destructive'
                : 'bg-success/10 text-success'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {item.visible_to_client
            ? item.is_blocking
              ? 'Client-facing · Required'
              : 'Client-facing'
            : 'Internal only'}
        </span>
      ),
    },
    {
      key: 'due_date',
      header: 'Due Date',
      sortable: true,
      render: (item: Task) => (
        <div className="flex items-center gap-1">
          {isOverdue(item.due_date, item.status) && (
            <AlertCircle className="w-4 h-4 text-destructive" />
          )}
          <span className={`text-sm ${isOverdue(item.due_date, item.status) ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
            {formatDate(item.due_date)}
          </span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: Task) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedTask(item);
              setShowEditModal(true);
            }}
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteTask(item.id);
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  const todoCount = tasks.filter(t => t.status === 'todo').length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
  const overdueCount = tasks.filter(t => isOverdue(t.due_date, t.status)).length;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Operations"
        title="Tasks"
        description="Manage tasks and follow-ups across every case."
        actions={
          <>
            <Button variant="outline" onClick={fetchTasks} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Task
            </Button>
          </>
        }
      />

      <TaskStatsCards
        totalItems={totalItems}
        todoCount={todoCount}
        inProgressCount={inProgressCount}
        overdueCount={overdueCount}
      />

      <TaskFilters
        searchQuery={searchQuery}
        onSearchChange={(v) => { setSearchQuery(v); setPage(1); }}
        selectedStatus={selectedStatus}
        onStatusChange={(v) => { setSelectedStatus(v); setPage(1); }}
        selectedPriority={selectedPriority}
        onPriorityChange={(v) => { setSelectedPriority(v); setPage(1); }}
        statusOptions={statusOptions}
        priorityOptions={priorityOptions}
      />

      <div>
        <DataTable
          columns={columns}
          data={tasks}
          loading={loading}
          sortConfig={sortConfig}
          onSort={(key, direction) => setSortConfig({ key, direction })}
          emptyMessage="No tasks found. Create your first task to get started."
        />
        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={setPage}
          onItemsPerPageChange={(n) => { setItemsPerPage(n); setPage(1); }}
        />
      </div>

      <TaskCreateModal open={showAddModal} editingTask={null} clients={clients} onClose={() => setShowAddModal(false)} onSaved={fetchTasks} />
      <TaskCreateModal open={showEditModal} editingTask={selectedTask} clients={clients} onClose={() => { setShowEditModal(false); setSelectedTask(null); }} onSaved={fetchTasks} />
      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}
        title="Delete Task"
        description="Are you sure you want to delete this task?"
        confirmLabel="Delete"
        onConfirm={confirmDeleteTask}
        variant="danger"
      />
    </div>
  );
}
