'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { 
  CheckSquare, 
  Plus, 
  Filter, 
  RefreshCw, 
  Loader2,
  Trash2,
  Edit2,
  AlertCircle,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DataTable } from '@/components/admin/DataTable';
import { Pagination } from '@/components/admin/Pagination';


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

const _getStatusVariant = (status: string) => {
  switch (status) {
    case 'done': return 'success';
    case 'in_progress': return 'info';
    case 'review': return 'warning';
    default: return 'default';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent': return 'text-red-500 bg-red-500/10';
    case 'high': return 'text-orange-500 bg-orange-500/10';
    case 'medium': return 'text-yellow-500 bg-yellow-500/10';
    case 'low': return 'text-green-500 bg-green-500/10';
    default: return 'text-muted-foreground bg-muted';
  }
};

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
  const [saving, setSaving] = React.useState(false);
  
  const [newTask, setNewTask] = React.useState({
    title: '',
    description: '',
    client_id: '',
    priority: 'medium',
    due_date: '',
    status: 'todo',
    visible_to_client: false,
    is_blocking: false,
  });

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

  const fetchClients = async () => {
    try {
      const response = await fetch('/api/admin/clients?limit=100');
      if (response.ok) {
        const data = await response.json();
        setClients(data.items);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  React.useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  React.useEffect(() => {
    fetchClients();
  }, []);

  const handleAddTask = async () => {
    if (!newTask.title.trim()) {
      alert('Title is required');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/admin/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTask,
          client_id: newTask.client_id || null,
          due_date: newTask.due_date || null,
        }),
      });

      if (response.ok) {
        setShowAddModal(false);
        setNewTask({
          title: '',
          description: '',
          client_id: '',
          priority: 'medium',
          due_date: '',
          status: 'todo',
          visible_to_client: false,
          is_blocking: false,
        });
        fetchTasks();
      }
    } catch (error) {
      console.error('Error adding task:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTask = async () => {
    if (!selectedTask) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/tasks/${selectedTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: selectedTask.title,
          description: selectedTask.description,
          client_id: selectedTask.client_id,
          status: selectedTask.status,
          priority: selectedTask.priority,
          due_date: selectedTask.due_date,
          visible_to_client: selectedTask.visible_to_client,
          is_blocking: selectedTask.is_blocking,
        }),
      });

      if (response.ok) {
        setShowEditModal(false);
        setSelectedTask(null);
        fetchTasks();
      }
    } catch (error) {
      console.error('Error updating task:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      const response = await fetch(`/api/admin/tasks/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchTasks();
      }
    } catch (error) {
      console.error('Error deleting task:', error);
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString();
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
                ? 'bg-red-500/10 text-red-500'
                : 'bg-green-500/10 text-green-500'
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
            <AlertCircle className="w-4 h-4 text-red-500" />
          )}
          <span className={`text-sm ${isOverdue(item.due_date, item.status) ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-serif font-bold text-foreground"
          >
            Tasks
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground mt-1"
          >
            Manage tasks and follow-ups
          </motion.p>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-2"
        >
          <Button variant="outline" onClick={fetchTasks} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Task
          </Button>
        </motion.div>
      </div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 sm:grid-cols-4 gap-4"
      >
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-500/10">
              <CheckSquare className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalItems}</p>
              <p className="text-sm text-muted-foreground">Total Tasks</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-yellow-500/10">
              <Clock className="w-6 h-6 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{todoCount}</p>
              <p className="text-sm text-muted-foreground">To Do</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-purple-500/10">
              <RefreshCw className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{inProgressCount}</p>
              <p className="text-sm text-muted-foreground">In Progress</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-red-500/10">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{overdueCount}</p>
              <p className="text-sm text-muted-foreground">Overdue</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="flex flex-col sm:flex-row items-start sm:items-center gap-4"
      >
        <div className="relative flex-1 max-w-sm">
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 rounded-md border border-input bg-background text-sm"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            value={selectedPriority}
            onChange={(e) => {
              setSelectedPriority(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 rounded-md border border-input bg-background text-sm"
          >
            {priorityOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </motion.div>

      {/* Data Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
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
          onItemsPerPageChange={(n) => {
            setItemsPerPage(n);
            setPage(1);
          }}
        />
      </motion.div>

      {/* Add Task Modal */}
      {showAddModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowAddModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md"
          >
            <Card className="bg-card border-border shadow-2xl">
              <CardHeader>
                <CardTitle>Add New Task</CardTitle>
                <CardDescription>Create a new task to track.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Title *</label>
                  <Input
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    placeholder="Task title"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <textarea
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    placeholder="Task description..."
                    className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Client</label>
                  <select
                    value={newTask.client_id}
                    onChange={(e) => setNewTask({ ...newTask, client_id: e.target.value })}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="">No client</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Priority</label>
                    <select
                      value={newTask.priority}
                      onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
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
                      value={newTask.due_date}
                      onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Client Portal</label>
                  <div className="flex flex-col gap-2 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newTask.visible_to_client}
                        onChange={(e) => setNewTask({ ...newTask, visible_to_client: e.target.checked })}
                        className="h-4 w-4 rounded border border-input"
                      />
                      <span>Show this task in the client portal</span>
                    </label>
                    <label className="flex items-center gap-2 pl-6">
                      <input
                        type="checkbox"
                        checked={newTask.is_blocking}
                        onChange={(e) => setNewTask({ ...newTask, is_blocking: e.target.checked })}
                        className="h-4 w-4 rounded border border-input"
                      />
                      <span>Required before starting next dispute round</span>
                    </label>
                  </div>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setShowAddModal(false)}>
                    Cancel
                  </Button>
                  <Button className="flex-1" onClick={handleAddTask} disabled={saving}>
                    {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Add Task
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* Edit Task Modal */}
      {showEditModal && selectedTask && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => {
            setShowEditModal(false);
            setSelectedTask(null);
          }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md"
          >
            <Card className="bg-card border-border shadow-2xl">
              <CardHeader>
                <CardTitle>Edit Task</CardTitle>
                <CardDescription>Update task details.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Title *</label>
                  <Input
                    value={selectedTask.title}
                    onChange={(e) => setSelectedTask({ ...selectedTask, title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <textarea
                    value={selectedTask.description || ''}
                    onChange={(e) => setSelectedTask({ ...selectedTask, description: e.target.value })}
                    className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Client</label>
                  <select
                    value={selectedTask.client_id || ''}
                    onChange={(e) => setSelectedTask({ ...selectedTask, client_id: e.target.value || null })}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="">No client</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Status</label>
                    <select
                      value={selectedTask.status}
                      onChange={(e) => setSelectedTask({ ...selectedTask, status: e.target.value as Task['status'] })}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="review">Review</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Priority</label>
                    <select
                      value={selectedTask.priority}
                      onChange={(e) => setSelectedTask({ ...selectedTask, priority: e.target.value as Task['priority'] })}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Due Date</label>
                  <Input
                    type="date"
                    value={selectedTask.due_date?.split('T')[0] || ''}
                    onChange={(e) => setSelectedTask({ ...selectedTask, due_date: e.target.value || null })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Client Portal</label>
                  <div className="flex flex-col gap-2 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedTask.visible_to_client}
                        onChange={(e) => setSelectedTask({ ...selectedTask, visible_to_client: e.target.checked })}
                        className="h-4 w-4 rounded border border-input"
                      />
                      <span>Show this task in the client portal</span>
                    </label>
                    <label className="flex items-center gap-2 pl-6">
                      <input
                        type="checkbox"
                        checked={selectedTask.is_blocking}
                        onChange={(e) => setSelectedTask({ ...selectedTask, is_blocking: e.target.checked })}
                        className="h-4 w-4 rounded border border-input"
                      />
                      <span>Required before starting next dispute round</span>
                    </label>
                  </div>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1" onClick={() => {
                    setShowEditModal(false);
                    setSelectedTask(null);
                  }}>
                    Cancel
                  </Button>
                  <Button className="flex-1" onClick={handleUpdateTask} disabled={saving}>
                    {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
