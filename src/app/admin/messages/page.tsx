'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { 
  MessageCircle, 
  Send, 
  Loader2, 
  User,
  ArrowLeft,
  Plus,
  X,
  Search
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/admin/StatusBadge';

interface MessageThread {
  id: string;
  client_id: string;
  subject: string;
  status: string;
  last_message_at: string;
  unread_by_admin: number;
  created_at: string;
  client_name: string;
  client_email: string;
}

interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_type: 'admin' | 'client';
  content: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  sender_name: string | null;
}

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export default function MessagesPage() {
  const [threads, setThreads] = React.useState<MessageThread[]>([]);
  const [selectedThread, setSelectedThread] = React.useState<MessageThread | null>(null);
  const [threadMessages, setThreadMessages] = React.useState<Message[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMessages, setLoadingMessages] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [newMessage, setNewMessage] = React.useState('');
  const [totalUnread, setTotalUnread] = React.useState(0);
  
  // New thread modal
  const [showNewThreadModal, setShowNewThreadModal] = React.useState(false);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = React.useState(false);
  const [clientSearch, setClientSearch] = React.useState('');
  const [selectedClient, setSelectedClient] = React.useState<Client | null>(null);
  const [newThreadSubject, setNewThreadSubject] = React.useState('');
  const [newThreadMessage, setNewThreadMessage] = React.useState('');

  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const fetchThreads = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/messages?limit=100');
      if (response.ok) {
        const data = await response.json();
        setThreads(data.items);
        setTotalUnread(data.total_unread);
      }
    } catch (error) {
      console.error('Error fetching threads:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (threadId: string) => {
    setLoadingMessages(true);
    try {
      const response = await fetch(`/api/admin/messages?thread_id=${threadId}`);
      if (response.ok) {
        const data = await response.json();
        setThreadMessages(data.messages);
        // Refresh threads to update unread counts
        fetchThreads();
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const fetchClients = async (search: string) => {
    setLoadingClients(true);
    try {
      const response = await fetch(`/api/admin/clients?search=${encodeURIComponent(search)}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setClients(data.items);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoadingClients(false);
    }
  };

  React.useEffect(() => {
    fetchThreads();
  }, []);

  React.useEffect(() => {
    if (selectedThread) {
      fetchMessages(selectedThread.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThread]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages]);

  React.useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (clientSearch.length >= 2) {
        fetchClients(clientSearch);
      } else {
        setClients([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [clientSearch]);

  const handleSelectThread = (thread: MessageThread) => {
    setSelectedThread(thread);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedThread) return;

    setSending(true);
    try {
      const response = await fetch('/api/admin/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: selectedThread.id,
          content: newMessage.trim(),
        }),
      });

      if (response.ok) {
        setNewMessage('');
        fetchMessages(selectedThread.id);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleCreateThread = async () => {
    if (!selectedClient || !newThreadSubject.trim() || !newThreadMessage.trim()) return;

    setSending(true);
    try {
      const response = await fetch('/api/admin/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClient.id,
          subject: newThreadSubject.trim(),
          content: newThreadMessage.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setShowNewThreadModal(false);
        setSelectedClient(null);
        setNewThreadSubject('');
        setNewThreadMessage('');
        setClientSearch('');
        fetchThreads();
        // Select the new thread
        const newThread: MessageThread = {
          id: data.threadId,
          client_id: selectedClient.id,
          subject: newThreadSubject,
          status: 'open',
          last_message_at: new Date().toISOString(),
          unread_by_admin: 0,
          created_at: new Date().toISOString(),
          client_name: `${selectedClient.first_name} ${selectedClient.last_name}`,
          client_email: selectedClient.email,
        };
        setSelectedThread(newThread);
      }
    } catch (error) {
      console.error('Error creating thread:', error);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-serif font-bold text-foreground"
          >
            Messages
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground mt-1"
          >
            Secure client communication portal
          </motion.p>
        </div>
        <div className="flex items-center gap-4">
          {totalUnread > 0 && (
            <span className="px-3 py-1 rounded-full bg-red-500 text-white text-sm font-medium">
              {totalUnread} unread
            </span>
          )}
          <Button onClick={() => setShowNewThreadModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Message
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100%-5rem)]">
        {/* Thread List */}
        <Card className="bg-card/80 backdrop-blur-sm border-border/50 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Conversations</CardTitle>
            <CardDescription>{threads.length} thread(s)</CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-y-auto h-[calc(100%-5rem)]">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : threads.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8 px-4">
                No message threads yet. Start a conversation with a client.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {threads.map((thread) => (
                  <div
                    key={thread.id}
                    onClick={() => handleSelectThread(thread)}
                    className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedThread?.id === thread.id ? 'bg-muted' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{thread.client_name}</p>
                          {thread.unread_by_admin > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-blue-500 text-white text-xs">
                              {thread.unread_by_admin}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{thread.subject}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs text-muted-foreground">
                          {thread.last_message_at ? formatTime(thread.last_message_at) : ''}
                        </span>
                        <StatusBadge 
                          status={thread.status} 
                          variant={thread.status === 'open' ? 'success' : 'default'}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Message View */}
        <Card className="lg:col-span-2 bg-card/80 backdrop-blur-sm border-border/50 flex flex-col overflow-hidden">
          {selectedThread ? (
            <>
              {/* Thread Header */}
              <CardHeader className="pb-2 border-b border-border">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    onClick={() => setSelectedThread(null)}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{selectedThread.subject}</CardTitle>
                    <CardDescription>
                      {selectedThread.client_name} &bull; {selectedThread.client_email}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingMessages ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  threadMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                          msg.sender_type === 'admin'
                            ? 'bg-secondary text-secondary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <div className="flex items-center justify-end gap-2 mt-1">
                          <span className="text-xs opacity-70">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {msg.sender_type === 'admin' && msg.is_read && (
                            <span className="text-xs opacity-70">Read</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-border">
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  <Button onClick={handleSendMessage} disabled={sending || !newMessage.trim()}>
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">Select a conversation to view messages</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* New Thread Modal */}
      {showNewThreadModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowNewThreadModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg"
          >
            <Card className="bg-card border-border shadow-2xl">
              <CardHeader>
                <CardTitle>New Message</CardTitle>
                <CardDescription>Start a new conversation with a client</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Client Search */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Client *</label>
                  {selectedClient ? (
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-secondary/10">
                          <User className="w-4 h-4 text-secondary" />
                        </div>
                        <div>
                          <p className="font-medium">{selectedClient.first_name} {selectedClient.last_name}</p>
                          <p className="text-xs text-muted-foreground">{selectedClient.email}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setSelectedClient(null)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        placeholder="Search clients by name or email..."
                        className="pl-10"
                      />
                      {clients.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                          {clients.map((client) => (
                            <div
                              key={client.id}
                              onClick={() => {
                                setSelectedClient(client);
                                setClientSearch('');
                                setClients([]);
                              }}
                              className="p-3 hover:bg-muted cursor-pointer flex items-center gap-3"
                            >
                              <User className="w-4 h-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium">{client.first_name} {client.last_name}</p>
                                <p className="text-xs text-muted-foreground">{client.email}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {loadingClients && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg p-3 flex items-center justify-center">
                          <Loader2 className="w-4 h-4 animate-spin" />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Subject */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Subject *</label>
                  <Input
                    value={newThreadSubject}
                    onChange={(e) => setNewThreadSubject(e.target.value)}
                    placeholder="Message subject"
                  />
                </div>

                {/* Message */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Message *</label>
                  <textarea
                    value={newThreadMessage}
                    onChange={(e) => setNewThreadMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary min-h-[120px]"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setShowNewThreadModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="flex-1"
                    onClick={handleCreateThread}
                    disabled={sending || !selectedClient || !newThreadSubject.trim() || !newThreadMessage.trim()}
                  >
                    {sending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Send Message
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
