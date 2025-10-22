import { useEffect, useState } from "react";
import { TaskCard } from "@/components/TaskCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Mail, MessageCircle, AlertCircle, CheckCircle2 } from "lucide-react";
import type { Task } from "@shared/schema";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNotification } from "@/contexts/NotificationContext";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function Tasks() {
  const [filter, setFilter] = useState<"all" | "gmail" | "whatsapp" | "reminder">("all");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, getIdToken } = useAuth();
  const { toast } = useToast();
  const { addNotification } = useNotification();

  useEffect(() => {
    // Only fetch reminders if user is authenticated
    if (!user) {
      console.log('No user authenticated, skipping reminder fetch');
      setLoading(false);
      return;
    }

    console.log('User authenticated, fetching reminders for:', user.uid);
    setLoading(true);
    
    // fetch reminders
    (async () => {
      try {
        // hydrate from cache first
        try {
          const cached = localStorage.getItem('cached_reminders');
          console.log('Raw cached data from localStorage:', cached);
          if (cached) {
            const parsed = JSON.parse(cached) as any[];
            console.log('Parsed cached data:', parsed);
            if (Array.isArray(parsed) && parsed.length > 0) {
              console.log('Loading cached reminders:', parsed.length);
              const cachedTasks = parsed.map((d, i) => ({
                id: d.id || `${d.created_at || d.createdAt || Date.now()}-${i}`,
                title: (d.message || '').slice(0,40) || 'Reminder',
                description: d.message,
                type: d.type === 'general' ? 'reminder' : d.type,
                priority: 'low',
                completed: d.status === 'sent',
                dueDate: d.datetime ? new Date(d.datetime) : undefined,
                createdAt: new Date(d.created_at || d.createdAt || Date.now()),
              } as Task));
              console.log('Mapped cached tasks:', cachedTasks);
              setTasks(cachedTasks);
            } else {
              console.log('No cached reminders found or empty array');
            }
          } else {
            console.log('No cached data in localStorage');
          }
        } catch (e) {
          console.warn('Failed to read cached reminders', e);
        }

        if (!getIdToken) {
          console.log('getIdToken not available');
          return;
        }
        const token = await getIdToken();
        if (!token) {
          console.log('No token available');
          return;
        }
        console.log('Fetching reminders from server...');
        const resp = await fetch('/api/reminders', { headers: { Authorization: `Bearer ${token}` } });
        console.log('API response status:', resp.status, resp.statusText);
        if (!resp.ok) {
          const text = await resp.text().catch(() => '');
          console.warn('/api/reminders failed', resp.status, text);
          // Keep existing tasks instead of wiping them on transient errors
          return;
        }
        const data = await resp.json().catch((e) => {
          console.error('Failed to parse /api/reminders JSON', e);
          return null;
        });
        console.log('Raw API response data:', data);
        if (!data) {
          // parsing failed or no data; leave existing tasks intact
          console.warn('No data returned from /api/reminders');
          return;
        }

        const rows = Array.isArray(data) ? data : (Array.isArray((data as any).data) ? (data as any).data : []);
        console.log('Processed rows from API:', rows);
        if (!Array.isArray(rows)) {
          console.warn('Unexpected /api/reminders response shape', data);
          // unexpected shape; do not clear existing tasks
          return;
        }

        console.log('Received reminders from server:', rows.length);

        const mapped = rows.map((d: any, i: number) => ({
          id: d.id || `${d.created_at || d.createdAt || Date.now()}-${i}`,
          title: (d.message || '').slice(0, 40) || 'Reminder',
          description: d.message,
          type: d.type === 'general' ? 'reminder' : d.type,
          priority: 'low',
          // only consider status === 'sent' as completed; failed should remain visible
          completed: d.status === 'sent',
          dueDate: d.datetime ? new Date(d.datetime) : undefined,
          createdAt: new Date(d.created_at || d.createdAt || Date.now()),
        } as Task));

        // dedupe by id (in case of duplicates) and preserve ordering
        const map = new Map<string, Task>();
        for (const t of mapped) map.set(t.id, t);
        const final = Array.from(map.values());
        console.log('Final tasks to set:', final);
        console.log('Setting tasks count:', final.length);
        setTasks(final);
        try {
          localStorage.setItem('cached_reminders', JSON.stringify(rows));
          console.log('Cached reminders to localStorage');
        } catch (e) {
          console.warn('Failed to cache reminders', e);
        }
      } catch (err) {
        console.error('Error fetching reminders', err);
        // keep cached tasks if fetch fails
      } finally {
        setLoading(false);
      }
    })();

    // SSE for general reminders
    let sse: EventSource | null = null;
    let isConnecting = false;
    
    const connectSSE = async () => {
      if (!user || isConnecting) return;
      isConnecting = true;
      
      try {
        const token = await getIdToken();
        if (!token) return;
        
        // Close existing connection if any
        if (sse) {
          sse.close();
          sse = null;
        }
        
        // request a short-lived connectId
        const resp = await fetch('/api/sse/connect', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
        if (!resp.ok) {
          console.error('SSE connect failed:', resp.status, resp.statusText);
          return;
        }
        const body = await resp.json();
        const connectId = body.connectId;
        console.log('SSE connecting with connectId:', connectId);
        
        sse = new EventSource(`/api/sse/stream/${connectId}`);
        
        sse.addEventListener("reminder", (ev: any) => {
          try {
            console.log('SSE reminder received:', ev.data);
            const d = JSON.parse(ev.data);
            
            // Check if we already have this reminder to avoid duplicates
            setTasks((prev) => {
              const existing = prev.find(t => t.id === d.id);
              if (existing) {
                console.log('Duplicate reminder ignored:', d.id);
                return prev;
              }
              
              const t: Task = {
                id: d.id,
                title: d.message.slice(0, 40),
                description: d.message,
                type: "reminder",
                priority: "low",
                completed: false,
                dueDate: d.datetime ? new Date(d.datetime) : undefined,
                createdAt: new Date(),
              };
              
              const map = new Map<string, Task>();
              map.set(t.id, t);
              for (const p of prev) map.set(p.id, p);
              return Array.from(map.values());
            });
            
            // show browser notification
            if (Notification.permission === "granted") {
              console.log('Showing browser notification for reminder:', d.message);
              new Notification("Reminder", { body: d.message });
            } else {
              console.log('Browser notification permission not granted:', Notification.permission);
            }
            // show in-app toast
            toast({ title: 'Reminder', description: d.message });
            // add to notification center
            addNotification({ id: d.id, title: d.message.slice(0,40), description: d.message, type: d.type, completedAt: new Date() });
          } catch (e) {
            console.error('Error processing SSE reminder:', e);
          }
        });
        
        sse.addEventListener("error", (ev) => {
          console.error('SSE error:', ev);
        });
        
        sse.addEventListener("open", () => {
          console.log('SSE connection opened');
        });
        
      } catch (err) {
        console.error('SSE setup failed', err);
      } finally {
        isConnecting = false;
      }
    };
    
    connectSSE();

    return () => {
      if (sse) {
        sse.close();
        sse = null;
      }
    };
  }, [user, getIdToken]);

  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  
  // request notification permission on mount (if not granted)
  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setNotificationPermission(Notification.permission);
      console.log('Current notification permission:', Notification.permission);
    } else {
      console.log('Notification API not available');
    }
  }, []);

  const requestNotificationPermission = async () => {
    console.log('Requesting notification permission...');
    
    if (typeof Notification === 'undefined') {
      console.error('Notification API not available');
      toast({ title: 'Notifications not supported', description: 'Your browser does not support notifications.', variant: 'destructive' });
      return;
    }
    
    try {
      console.log('Current permission before request:', Notification.permission);
      
      // Check if we can request permission
      if (Notification.permission === 'denied') {
        console.log('Permission already denied, cannot request again');
        toast({ 
          title: 'Notifications blocked', 
          description: 'Notifications are blocked. Please enable them manually in your browser settings (click the lock icon in the address bar).', 
          variant: 'destructive' 
        });
        return;
      }
      
      const permission = await Notification.requestPermission();
      console.log('Permission request result:', permission);
      setNotificationPermission(permission);
      
      if (permission === 'granted') {
        toast({ title: 'Notifications enabled', description: 'You will now receive browser notifications for reminders' });
        // Test notification
        new Notification('Test Notification', { 
          body: 'Notifications are now working!',
          icon: '/favicon.ico'
        });
      } else if (permission === 'denied') {
        toast({ 
          title: 'Notifications blocked', 
          description: 'Please enable notifications in your browser settings (click the lock icon in the address bar).', 
          variant: 'destructive' 
        });
      } else {
        toast({ 
          title: 'Permission request dismissed', 
          description: 'Please try again and click "Allow" when prompted.', 
          variant: 'destructive' 
        });
      }
    } catch (err) {
      console.error('Error requesting notification permission:', err);
      toast({ 
        title: 'Error', 
        description: 'Failed to request notification permission. Please enable manually in browser settings.', 
        variant: 'destructive' 
      });
    }
  };

  const handleToggle = (id: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
    // persist
    const task = tasks.find((t) => t.id === id);
    if (task) {
      const newStatus = task.completed ? 'pending' : 'sent';
      fetch(`/api/reminders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) }).catch(console.error);
      (async () => {
        try {
          const token = await getIdToken();
          if (!token) return;
          const newStatus = task.completed ? 'pending' : 'sent';
          const resp = await fetch(`/api/reminders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: newStatus }) });
          if (resp.ok) {
            toast({ title: 'Task updated', description: `Task ${task.title} marked ${newStatus === 'sent' ? 'complete' : 'pending'}` });
            if (newStatus === 'sent') {
              addNotification({ id: task.id, title: task.title, description: task.description, type: task.type, completedAt: new Date() });
            }
          }
        } catch (err) {
          console.error(err);
        }
      })();
    }
  };

  const handleDelete = (id: string) => {
    (async () => {
      try {
        const token = await getIdToken();
        if (!token) return;
        await fetch(`/api/reminders/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      } catch (err) {
        console.error(err);
      } finally {
        setTasks((prev) => prev.filter((task) => task.id !== id));
      }
    })();
  };

  const handleAdd = async () => {
    // Open modal handled via component state
  };

  // --- Modal form state and submit handler ---
  const [open, setOpen] = useState(false);
  const [formType, setFormType] = useState<'general' | 'whatsapp' | 'gmail'>('general');
  const [formMessage, setFormMessage] = useState('');
  // Helper: format a Date to a value usable by <input type="datetime-local"> (YYYY-MM-DDTHH:mm)
  const formatForDatetimeLocal = (d: Date) => {
    const tzOffset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - tzOffset * 60000);
    return local.toISOString().slice(0, 16); // drop seconds
  };

  const [formDatetime, setFormDatetime] = useState(() => formatForDatetimeLocal(new Date(Date.now() + 60000)));
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async () => {
    // Prevent creating gmail/whatsapp tasks if credentials are not saved in Settings
    const integrationType = formType === 'gmail' ? 'gmail' : formType === 'whatsapp' ? 'whatsapp' : null;
    if (integrationType) {
      try {
        const uid = user?.uid || localStorage.getItem('userId');
        const flag = uid ? localStorage.getItem(`has_${integrationType}_${uid}`) : null;
        if (flag !== 'true') {
          setErrors({ ...errors, credentials: `Please add ${integrationType} credentials in Settings before creating ${integrationType} tasks.` });
          toast({ title: 'Missing credentials', description: `Go to Settings and save your ${integrationType} credentials to enable ${integrationType} tasks.`, variant: 'destructive' });
          return;
        }
      } catch (e) {
        // ignore storage errors
      }
    }
    const newErrors: Record<string, string> = {};
    if (!formMessage) newErrors.message = 'Message is required';
    // validate datetime
    const parsedDate = Date.parse(formDatetime);
    if (Number.isNaN(parsedDate)) newErrors.datetime = 'Please provide a valid date/time';
    // phone validation for E.164 (basic)
    if (formType === 'whatsapp') {
      const phoneRegex = /^\+[1-9]\d{7,14}$/;
      if (!formPhone) newErrors.phone = 'Phone is required for WhatsApp reminders';
      else if (!phoneRegex.test(formPhone)) newErrors.phone = 'Phone must be in E.164 format, e.g. +15551234567';
    }
    // gmail validation for gmail addresses only
    if (formType === 'gmail') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!formEmail) newErrors.email = 'Email is required for Gmail reminders';
      else if (!emailRegex.test(formEmail)) newErrors.email = 'Please provide a valid email address';
      else if (!formEmail.toLowerCase().endsWith('@gmail.com') && !formEmail.toLowerCase().endsWith('@googlemail.com')) {
        newErrors.email = 'Please provide a Gmail address (gmail.com)';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
  // formDatetime is in local 'YYYY-MM-DDTHH:mm' format; parse as local and convert to ISO UTC
  const localDate = new Date(formDatetime);
  const payload: any = { user_id: user?.uid, type: formType, message: formMessage, datetime: localDate.toISOString() };
      if (formType === 'whatsapp') payload.user_phone = formPhone;
      if (formType === 'gmail') { payload.user_email = formEmail; }
      const token = await getIdToken();
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch('/api/reminders', { method: 'POST', headers, body: JSON.stringify(payload) });
      const data = await res.json();
      if (res.ok) {
        const t: Task = {
          id: data.id,
          title: data.message.slice(0, 40),
          description: data.message,
          type: data.type === 'general' ? 'reminder' : data.type,
          priority: 'low',
          completed: false,
          dueDate: data.datetime ? new Date(data.datetime) : undefined,
          createdAt: new Date(data.created_at || Date.now()),
        };
        setTasks((prev) => {
          const map = new Map<string, Task>();
          map.set(t.id, t);
          for (const p of prev) map.set(p.id, p);
          return Array.from(map.values());
        });
        setOpen(false);
        // reset
        setFormMessage('');
        setFormPhone('');
        setFormEmail('');
      } else {
        alert('Failed to create reminder: ' + (data.message || 'unknown'));
      }
    } catch (err) {
      console.error(err);
      alert('Failed to create reminder');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTasks = tasks.filter((task) => {
    if (filter === "all") return true;
    return task.type === filter;
  });

  const activeTasks = filteredTasks.filter((t) => !t.completed);
  const completedTasks = filteredTasks.filter((t) => t.completed);

  const stats = [
    {
      label: "Active Tasks",
      value: activeTasks.length,
      icon: AlertCircle,
      gradient: "from-chart-1/20 to-chart-1/10",
      iconColor: "text-chart-1",
    },
    {
      label: "Completed",
      value: completedTasks.length,
      icon: CheckCircle2,
      gradient: "from-chart-3/20 to-chart-3/10",
      iconColor: "text-chart-3",
    },
    {
      label: "Gmail",
      value: tasks.filter((t) => t.type === "gmail").length,
      icon: Mail,
      gradient: "from-chart-2/20 to-chart-2/10",
      iconColor: "text-chart-2",
    },
    {
      label: "WhatsApp",
      value: tasks.filter((t) => t.type === "whatsapp").length,
      icon: MessageCircle,
      gradient: "from-chart-4/20 to-chart-4/10",
      iconColor: "text-chart-4",
    },
  ];

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-background via-chart-3/5 to-chart-4/5 relative">
      <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none" />
      
      <div className="max-w-6xl mx-auto p-6 space-y-8 relative z-10">
        <div className="flex items-center justify-between gap-4 flex-wrap animate-in fade-in slide-in-from-top-4 duration-700">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-chart-3 via-chart-4 to-chart-3 bg-clip-text text-transparent mb-2" data-testid="text-page-title">
              Tasks Dashboard
            </h1>
            <p className="text-muted-foreground text-lg">
              Manage your Gmail, WhatsApp, and reminder tasks
            </p>
          </div>
          
          <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
              <Button 
                data-testid="button-add-task" 
                className="bg-gradient-to-r from-chart-3 to-chart-4 hover:shadow-lg hover:shadow-chart-3/30 transition-all duration-300 hover:scale-105"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            </AlertDialogTrigger>

            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Create a Task</AlertDialogTitle>
                <AlertDialogDescription>
                  Create a Gmail, WhatsApp or general reminder task.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="space-y-4">
                <div>
                  <Label>Type</Label>
                  <Select onValueChange={(v) => setFormType(v as any)} value={formType}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="gmail">Gmail</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.credentials && <p className="text-sm text-destructive mt-2">{errors.credentials}</p>}
                </div>
                <div>
                  <Label>Message</Label>
                  <Textarea value={formMessage} onChange={(e) => setFormMessage(e.target.value)} />
                  {errors.message && <p className="text-sm text-destructive mt-1">{errors.message}</p>}
                </div>
                <div>
                  <Label>Datetime</Label>
                  <Input type="datetime-local" value={formDatetime} onChange={(e) => setFormDatetime(e.target.value)} />
                  {errors.datetime && <p className="text-sm text-destructive mt-1">{errors.datetime}</p>}
                </div>
                {formType === 'whatsapp' && (
                  <div>
                    <Label>Phone (E.164)</Label>
                    <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="+15551234567" />
                    {errors.phone && <p className="text-sm text-destructive mt-1">{errors.phone}</p>}
                  </div>
                )}
                {formType === 'gmail' && (
                  <div>
                    <Label>Email</Label>
                    <Input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="you@gmail.com" />
                    {errors.email && <p className="text-sm text-destructive mt-1">{errors.email}</p>}
                  </div>
                )}
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleSubmit} disabled={submitting || Boolean(errors.credentials)}>{submitting ? 'Creating...' : 'Create'}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="relative p-4 rounded-2xl bg-card/80 backdrop-blur-xl border-2 hover:shadow-lg transition-all duration-300 hover:scale-105 group overflow-hidden"
              style={{ animationDelay: `${200 + index * 50}ms` }}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-50 group-hover:opacity-70 transition-opacity duration-300`} />
              <div className="relative flex items-center gap-3">
                <stat.icon className={`h-8 w-8 ${stat.iconColor}`} />
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList className="bg-card/80 backdrop-blur-xl border">
              <TabsTrigger value="all" data-testid="tab-all" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/10 data-[state=active]:to-chart-2/10">
                All ({tasks.length})
              </TabsTrigger>
              <TabsTrigger value="gmail" data-testid="tab-gmail" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-chart-1/10 data-[state=active]:to-chart-2/10">
                <Mail className="h-4 w-4 mr-1" />
                Gmail ({tasks.filter((t) => t.type === "gmail").length})
              </TabsTrigger>
              <TabsTrigger value="whatsapp" data-testid="tab-whatsapp" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-chart-3/10 data-[state=active]:to-chart-4/10">
                <MessageCircle className="h-4 w-4 mr-1" />
                WhatsApp ({tasks.filter((t) => t.type === "whatsapp").length})
              </TabsTrigger>
              <TabsTrigger value="reminder" data-testid="tab-reminder" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-chart-4/10 data-[state=active]:to-chart-5/10">
                <AlertCircle className="h-4 w-4 mr-1" />
                Reminders ({tasks.filter((t) => t.type === "reminder").length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {loading ? (
          <div className="text-center py-20 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
            <div className="mb-6 inline-flex">
              <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-chart-3/20 to-chart-4/20 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-chart-3"></div>
              </div>
            </div>
            <h3 className="text-2xl font-semibold mb-2">Loading tasks...</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Please wait while we fetch your reminders and tasks.
            </p>
          </div>
        ) : activeTasks.length === 0 && completedTasks.length === 0 ? (
          <div className="text-center py-20 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
            <div className="mb-6 inline-flex">
              <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-chart-3/20 to-chart-4/20 flex items-center justify-center">
                <CheckCircle2 className="h-12 w-12 text-chart-3" />
              </div>
            </div>
            <h3 className="text-2xl font-semibold mb-2">No tasks found</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Create your first task to get started with organizing your work!
            </p>
            <Button className="bg-gradient-to-r from-chart-3 to-chart-4">
              <Plus className="h-4 w-4 mr-2" />
              Create Task
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            {activeTasks.length > 0 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-400">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-chart-1/20 to-chart-1/10 flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-chart-1" />
                  </div>
                  <h2 className="text-2xl font-semibold">Active Tasks</h2>
                  <span className="px-3 py-1 rounded-full bg-chart-1/10 text-chart-1 text-sm font-medium">
                    {activeTasks.length}
                  </span>
                </div>
                <div className="grid gap-4">
                  {activeTasks.map((task, index) => (
                    <div 
                      key={task.id}
                      className="animate-in fade-in slide-in-from-left duration-500"
                      style={{ animationDelay: `${450 + index * 50}ms` }}
                    >
                      <TaskCard
                        task={task}
                        onToggle={handleToggle}
                        onDelete={handleDelete}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {completedTasks.length > 0 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-600">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-chart-3/20 to-chart-3/10 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-chart-3" />
                  </div>
                  <h2 className="text-2xl font-semibold">Completed</h2>
                  <span className="px-3 py-1 rounded-full bg-chart-3/10 text-chart-3 text-sm font-medium">
                    {completedTasks.length}
                  </span>
                </div>
                <div className="grid gap-4">
                  {completedTasks.map((task, index) => (
                    <div 
                      key={task.id}
                      className="animate-in fade-in slide-in-from-left duration-500"
                      style={{ animationDelay: `${650 + index * 50}ms` }}
                    >
                      <TaskCard
                        task={task}
                        onToggle={handleToggle}
                        onDelete={handleDelete}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
