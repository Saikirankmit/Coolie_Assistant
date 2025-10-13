import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getFirebaseStorage, getFirebaseAuth } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import WhatsappConnect from "@/components/WhatsappConnect";
import { Camera, User, Bell, Globe, Shield } from "lucide-react";
import type { UserPreferences } from "@shared/schema";
// Textarea not needed for masked secrets; using Input (password) instead

export default function Settings() {
  const { user, getIdToken, signOut, loading: authLoading } = useAuth();
  const { toast } = useToast();

  // Gmail & WhatsApp credentials state
  const [gmailCredentials, setGmailCredentials] = useState({
    gmailApiKey: "",
    gmailClientId: "",
    gmailClientSecret: "",
    gmailRefreshToken: "",
  });
  const [hasGmailCreds, setHasGmailCreds] = useState(false);
  // removed WhatsApp connector state and UI
  const [savingCreds, setSavingCreds] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const saveCredentialFlag = (type: 'gmail' | 'whatsapp', uid: string) => {
    try {
      localStorage.setItem(`has_${type}_${uid}`, 'true');
    } catch (e) {
      // ignore
    }
  };

  const N8N_BASE = (import.meta as any)?.env?.VITE_N8N_BASE_URL ?? '';
  const ENDPOINTS = {
    gmail: {
      save: N8N_BASE ? `${N8N_BASE}/webhook/save-gmail-credentials` : '/api/external/save-gmail-credentials',
      action: N8N_BASE ? `${N8N_BASE}/webhook/gmail-action` : '/api/external/gmail-action',
    },
  };

  const getAuthHeaders = async (): Promise<Record<string,string>> => {
    try {
      if (typeof getIdToken === 'function') {
        const token = await getIdToken();
        if (token) return { Authorization: `Bearer ${token}` };
      }
    } catch (e) {
      // ignore
    }
    return {};
  };

  // On first mount: capture ?connected=gmail and persist to localStorage so refresh keeps state
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('connected') === 'gmail') {
        setHasGmailCreds(true);
        try { localStorage.setItem('has_gmail', 'true'); } catch (e) {}
        toast({ title: 'Gmail connected', description: 'Your Gmail account was connected successfully.' });
        // remove query param so UI doesn't show blanks later
        params.delete('connected');
        const cleaned = window.location.pathname + (params.toString() ? `?${params.toString()}` : '');
        window.history.replaceState({}, '', cleaned);
      }
    } catch (e) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After auth state loads, verify with server whether Gmail credentials exist.
  // If server call fails or user not logged in, fall back to localStorage flag.
  useEffect(() => {
    (async () => {
      if (authLoading) return;
      try {
        const headers = await getAuthHeaders();
        const resp = await fetch('/api/integrations/status', { headers });
        if (resp.ok) {
          const body = await resp.json().catch(() => ({}));
          if (body && body.gmail) {
            setHasGmailCreds(true);
            try { localStorage.setItem('has_gmail', 'true'); } catch (e) {}
            return;
          }
        }
      } catch (e) {
        // ignore
      }
      // fallback to localStorage if server check not available or returned false
      try {
        const flag = localStorage.getItem('has_gmail');
        setHasGmailCreds(!!flag);
      } catch (e) {
        // ignore
      }
    })();
  }, [authLoading]);

  const handleSaveGmailCredentials = async (e?: any) => {
    e?.preventDefault?.();
    setSavingCreds(true);
    try {
      const uid = user?.uid || localStorage.getItem('userId');
      if (!uid) throw new Error('No user id');
  const headers = await getAuthHeaders();
  const resp = await fetch(ENDPOINTS.gmail.save, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ userId: uid, credentials: gmailCredentials }) });
  const res = await resp.json().catch(() => ({ status: resp.ok ? 'success' : 'error', error: resp.ok ? undefined : 'Save failed' }));
  if (res?.status === 'success') {
        setHasGmailCreds(true);
        saveCredentialFlag('gmail', uid);
        toast({ title: 'Gmail saved', description: 'Gmail credentials saved successfully.' });
        // Keep inputs as-is to reassure user; do not clear after save
        // refresh server status to ensure persistence is reflected after save
        try {
          const headers = await getAuthHeaders();
          const chk = await fetch('/api/integrations/status', { headers });
          const payload = await chk.json().catch(() => ({}));
          if (chk.ok && payload) {
            setHasGmailCreds(!!payload.gmail);
          }
        } catch (_) {}
      } else {
        toast({ title: 'Failed', description: res?.error || 'Failed to save Gmail credentials', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || String(err), variant: 'destructive' });
    } finally {
      setSavingCreds(false);
    }
  };

  // WhatsApp credential handlers removed

  // WhatsApp connector logic removed

  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: "system",
    notifications: true,
    language: "en",
  });

  const handleSaveProfile = () => {
    console.log("Saving profile");
    toast({
      title: "Profile updated",
      description: "Your profile information has been saved.",
    });
  };

  const handleSavePreferences = () => {
    console.log("Saving preferences:", preferences);
    toast({
      title: "Preferences saved",
      description: "Your settings have been updated.",
    });
  };

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-background via-primary/5 to-chart-5/5 relative">
      <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none" />
      
      <div className="max-w-4xl mx-auto p-6 space-y-8 relative z-10">
        <div className="text-center space-y-3 py-6 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="inline-flex">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-chart-5 flex items-center justify-center shadow-lg shadow-primary/20">
              <User className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-chart-5 to-primary bg-clip-text text-transparent" data-testid="text-page-title">
            Settings
          </h1>
          <p className="text-muted-foreground text-lg">
            Manage your profile and application preferences
          </p>
        </div>

        <Card className="p-8 backdrop-blur-xl bg-card/80 border-2 hover-elevate transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-lg -z-10" />
          
          <div className="space-y-8">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">Profile</h2>
            </div>
            
            <div className="space-y-6">
              <div className="flex items-center gap-6 p-6 rounded-2xl bg-gradient-to-br from-primary/5 to-chart-2/5 border-2 border-primary/10">
                <div className="relative group">
                  <Avatar className="h-24 w-24 border-4 border-background shadow-xl">
                    <AvatarImage src={previewUrl ?? user?.photoURL ?? ""} alt={user?.displayName || ""} />
                    <AvatarFallback className="text-3xl bg-gradient-to-br from-primary to-chart-2 text-primary-foreground">
                      {user?.displayName?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <input
                    id="avatar-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (ev) => {
                      const file = ev.target.files?.[0];
                      if (!file) return;
                      // validate size (max 5MB)
                      if (file.size > 5 * 1024 * 1024) {
                        toast({ title: 'Image too large', description: 'Please pick an image smaller than 5MB', variant: 'destructive' });
                        return;
                      }
                      // show preview
                      try {
                        const url = URL.createObjectURL(file);
                        setPreviewUrl(url);
                      } catch (e) {
                        // ignore
                      }

                      // upload to Firebase Storage
                      try {
                        const storage = getFirebaseStorage();
                        const auth = getFirebaseAuth();
                        if (!storage || !auth) throw new Error('Firebase not configured');
                        const current = auth.currentUser;
                        if (!current) throw new Error('Not authenticated');

                        const ext = file.name.split('.').pop() || 'jpg';
                        const path = `users/${current.uid}/avatar.${ext}`;
                        const storageRef = (await import('firebase/storage')).ref(storage, path);

                        setUploading(true);
                        setUploadProgress(0);

                        const uploadTask = (await import('firebase/storage')).uploadBytesResumable(storageRef, file);

                        uploadTask.on('state_changed', (snapshot: any) => {
                          if (!snapshot) return;
                          const prog = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                          setUploadProgress(prog);
                        }, (error: any) => {
                          console.error('upload failed', error);
                          toast({ title: 'Upload failed', description: String(error), variant: 'destructive' });
                          setUploading(false);
                          setUploadProgress(null);
                        }, async () => {
                          try {
                            const url = await (await import('firebase/storage')).getDownloadURL(uploadTask.snapshot.ref);
                            // update firebase user profile
                            try {
                              const { updateProfile } = await import('firebase/auth');
                              await updateProfile(current, { photoURL: url });
                            } catch (e) {
                              console.error('updateProfile failed', e);
                            }
                            toast({ title: 'Avatar updated', description: 'Your profile photo was uploaded.' });
                          } catch (e) {
                            console.error('getDownloadURL failed', e);
                            toast({ title: 'Upload failed', description: 'Could not get file URL', variant: 'destructive' });
                          } finally {
                            setUploading(false);
                            setUploadProgress(null);
                          }
                        });
                      } catch (err: any) {
                        console.error('avatar upload error', err);
                        toast({ title: 'Upload error', description: err?.message || String(err), variant: 'destructive' });
                        setUploading(false);
                        setUploadProgress(null);
                      }
                    }}
                  />
                  <label htmlFor="avatar-input">
                    <Button
                      size="icon"
                      className="absolute -bottom-2 -right-2 h-10 w-10 rounded-full shadow-lg bg-gradient-to-br from-primary to-chart-2 hover:scale-110 transition-transform duration-300"
                      data-testid="button-change-avatar"
                    >
                      <Camera className="h-5 w-5" />
                    </Button>
                  </label>
                </div>
                <div className="flex-1 space-y-2">
                  <p className="font-bold text-2xl" data-testid="text-display-name">{user?.displayName}</p>
                  <p className="text-muted-foreground flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    {user?.email}
                  </p>
                  <div className="flex gap-2 pt-2">
                    <div className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      Active User
                    </div>
                    <div className="px-3 py-1 rounded-full bg-chart-3/10 text-chart-3 text-xs font-medium">
                      Verified
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="display-name" className="text-sm font-medium flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    Display Name
                  </Label>
                  <Input
                    id="display-name"
                    defaultValue={user?.displayName || ""}
                    data-testid="input-display-name"
                    className="transition-all duration-300 focus:ring-2 focus:ring-primary/50 bg-background/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    defaultValue={user?.email || ""}
                    disabled
                    data-testid="input-email"
                    className="bg-muted/50"
                  />
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    Email cannot be changed for security reasons
                  </p>
                </div>
              </div>

              <Button 
                onClick={handleSaveProfile} 
                data-testid="button-save-profile"
                className="bg-gradient-to-r from-primary to-chart-2 hover:shadow-lg hover:shadow-primary/30 transition-all duration-300 hover:scale-[1.02]"
              >
                Save Profile Changes
              </Button>
            </div>
          </div>
        </Card>

        {/* WhatsApp connector removed */}

        {/* Gmail Credentials Card */}
        <Card className="p-8 backdrop-blur-xl bg-card/80 border-2 hover-elevate transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-lg -z-10" />
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">Gmail Integration</h2>
            </div>

            {hasGmailCreds ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-semibold">Gmail Connected</div>
                    <div className="text-sm text-muted-foreground">Your Gmail account is connected. Only one Gmail account can be connected at a time. When connected, the app can send and read messages on your behalf for reminders and automation.</div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-sm text-green-600 font-medium">Connected</div>
                    <Button variant="ghost" onClick={async () => {
                      try {
                        const headers = await getAuthHeaders();
                        const resp = await fetch('/api/external/save-gmail-credentials', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ credentials: null }) });
                        // server returns 200 even on error payload; treat non-ok as error
                        if (!resp.ok) throw new Error('Failed to disconnect');
                        setHasGmailCreds(false);
                        toast({ title: 'Disconnected', description: 'Gmail integration disconnected.' });
                      } catch (err: any) {
                        console.error('disconnect gmail failed', err);
                        toast({ title: 'Failed', description: 'Could not disconnect Gmail', variant: 'destructive' });
                      }
                    }}>Disconnect</Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-3">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">When enabled, Coolie Assistant can manage your Gmail account to send reminders and perform email automations on your behalf. Only one Gmail account may be connected at a time.</p>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="text-sm text-muted-foreground">Status: {hasGmailCreds ? <span className="text-green-600">Connected</span> : <span className="text-gray-500">Not connected</span>}</div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={async () => {
                      try {
                        const headers = await getAuthHeaders();
                        // If we're running in a dev/debug mode where the server accepts a uid query param,
                        // append the current user's uid so the server won't fallback to a debug value.
                        let startUrl = '/api/oauth/google/start';
                        if (user?.uid) startUrl += `?uid=${encodeURIComponent(user.uid)}`;
                        const resp = await fetch(startUrl, { headers });
                        const ct = resp.headers.get('content-type') || '';
                        if (!resp.ok) {
                          const body = await resp.text().catch(() => '');
                          console.error('oauth start failed', resp.status, body);
                          alert(`Failed to start Google OAuth (HTTP ${resp.status}). See console for details.`);
                          return;
                        }

                        if (ct.includes('application/json')) {
                          const json = await resp.json();
                          if (json?.url) {
                            window.location.href = json.url;
                            return;
                          }
                          console.error('oauth start returned json without url', json);
                          alert('Failed to start Google OAuth: missing URL in response');
                          return;
                        }

                        // non-json response (likely an HTML error or index.html). Try a backend fallback (common when only Vite is running).
                        const text = await resp.text().catch(() => '');
                        console.error('oauth start returned non-json response (likely frontend dev server):', text.slice(0, 200));

                        // Attempt to contact backend directly on port 5050 (dev default) as a fallback
                        try {
                          const headers2 = await getAuthHeaders();
                          const backendOrigin = `${window.location.protocol}//${window.location.hostname}:5050`;
                          // If user is available, append uid to help debug-only server flows use the real UID
                          let backendUrl = `${backendOrigin}/api/oauth/google/start`;
                          if (user?.uid) backendUrl += `?uid=${encodeURIComponent(user.uid)}`;
                          const resp2 = await fetch(backendUrl, { headers: headers2 });
                          const ct2 = resp2.headers.get('content-type') || '';
                          if (!resp2.ok) {
                            const body2 = await resp2.text().catch(() => '');
                            console.error('oauth start backend failed', resp2.status, body2);
                            alert(`Failed to start Google OAuth (backend HTTP ${resp2.status}). See console.`);
                            return;
                          }
                          if (ct2.includes('application/json')) {
                            const json2 = await resp2.json();
                            if (json2?.url) {
                              window.location.href = json2.url;
                              return;
                            }
                            console.error('oauth start backend returned json without url', json2);
                            alert('Failed to start Google OAuth: backend returned missing URL');
                            return;
                          }
                          const text2 = await resp2.text().catch(() => '');
                          console.error('oauth start backend returned non-json response:', text2.slice(0, 200));
                          alert('Failed to start Google OAuth: server returned unexpected response (see console)');
                        } catch (err) {
                          console.error('oauth start backend request failed', err);
                          alert('Failed to reach backend at http://localhost:5050 - ensure you started the server with `npm run dev`. See console.');
                        }
                      } catch (e) {
                        console.error('start oauth failed', e);
                        alert('Failed to start Google OAuth (network error)');
                      }
                    }}>Connect Gmail</Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
        {/* WhatsApp connect component */}
        <div>
          {/* lazy-loaded component to avoid increasing initial bundle - simple import here */}
          {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
          {/* @ts-ignore */}
          <WhatsappConnect />
        </div>

        <Card className="p-8 backdrop-blur-xl bg-card/80 border-2 hover-elevate transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-chart-3/5 to-transparent rounded-lg -z-10" />
          
          <div className="space-y-8">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-chart-3/20 to-chart-3/10 flex items-center justify-center">
                <Bell className="h-5 w-5 text-chart-3" />
              </div>
              <h2 className="text-2xl font-bold">Preferences</h2>
            </div>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between p-5 rounded-2xl bg-gradient-to-br from-chart-3/5 to-chart-4/5 border border-chart-3/20 hover:border-chart-3/40 transition-colors duration-300">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-chart-3/20 to-chart-3/10 flex items-center justify-center">
                    <Bell className="h-6 w-6 text-chart-3" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="notifications" className="text-base font-semibold cursor-pointer">
                      Notifications
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications for new tasks and messages
                    </p>
                  </div>
                </div>
                <Switch
                  id="notifications"
                  checked={preferences.notifications}
                  onCheckedChange={(checked) =>
                    setPreferences({ ...preferences, notifications: checked })
                  }
                  data-testid="switch-notifications"
                  className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-chart-3 data-[state=checked]:to-chart-4"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Button 
                    onClick={handleSavePreferences} 
                    data-testid="button-save-preferences"
                    className="bg-gradient-to-r from-chart-3 to-chart-4 hover:shadow-lg hover:shadow-chart-3/30 transition-all duration-300 hover:scale-[1.02]"
                  >
                    Save Preferences
                  </Button>
                </div>
                <div className="pl-4">
                  <Button variant="ghost" onClick={async () => {
                    try {
                      await signOut?.();
                    } catch (e) {
                      console.error('signout failed', e);
                    }
                  }}>Sign out</Button>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Danger Zone removed per user request */}
      </div>
    </div>
  );
}
