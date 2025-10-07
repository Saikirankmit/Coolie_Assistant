import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Camera, User, Bell, Globe, Shield, AlertTriangle } from "lucide-react";
import type { UserPreferences } from "@shared/schema";
// Textarea not needed for masked secrets; using Input (password) instead

export default function Settings() {
  const { user, getIdToken } = useAuth();
  const { toast } = useToast();

  // Gmail & WhatsApp credentials state
  const [gmailCredentials, setGmailCredentials] = useState({
    gmailApiKey: "",
    gmailClientId: "",
    gmailClientSecret: "",
    gmailRefreshToken: "",
  });
  const [hasGmailCreds, setHasGmailCreds] = useState(false);

  const [whatsappCredentials, setWhatsappCredentials] = useState({
    whatsappApiKey: "",
    whatsappPhoneNumberId: "",
    whatsappBusinessAccountId: "",
    whatsappAccessToken: "",
  });
  const [hasWhatsappCreds, setHasWhatsappCreds] = useState(false);

  const [savingCreds, setSavingCreds] = useState(false);

  useEffect(() => {
    try {
      const uid = user?.uid || localStorage.getItem('userId');
      if (!uid) return;
      setHasGmailCreds(localStorage.getItem(`has_gmail_${uid}`) === 'true');
      setHasWhatsappCreds(localStorage.getItem(`has_whatsapp_${uid}`) === 'true');
    } catch (e) {
      // ignore
    }
  }, [user]);

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
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
    whatsapp: {
      save: N8N_BASE ? `${N8N_BASE}/webhook/save-whatsapp-credentials` : '/api/external/save-whatsapp-credentials',
      action: N8N_BASE ? `${N8N_BASE}/webhook/whatsapp-action` : '/api/external/whatsapp-action',
    },
  };

  const postJson = async (url: string, body: any) => {
    const authHeaders = await getAuthHeaders();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authHeaders.Authorization) headers.Authorization = authHeaders.Authorization;
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    const text = await res.text();
    // Try parse JSON, but handle HTML/error pages gracefully
    try {
      const data = text ? JSON.parse(text) : {};
      // include status for callers
      return { httpStatus: res.status, ...data };
    } catch (err) {
      // Non-JSON response (often an HTML error page). Return structured error so callers can show it.
      const snippet = text ? text.slice(0, 200) : "";
      return {
        httpStatus: res.status,
        status: 'error',
        error: `Expected JSON but received ${res.headers.get('content-type') || 'unknown'} (HTTP ${res.status})`,
        body: snippet,
      };
    }
  };

  const handleSaveGmailCredentials = async (e?: any) => {
    e?.preventDefault?.();
    setSavingCreds(true);
    try {
      const uid = user?.uid || localStorage.getItem('userId');
      if (!uid) throw new Error('No user id');
      const res = await postJson(ENDPOINTS.gmail.save, { userId: uid, credentials: gmailCredentials });
      if (res?.status === 'success') {
        setHasGmailCreds(true);
        saveCredentialFlag('gmail', uid);
        toast({ title: 'Gmail saved', description: 'Gmail credentials saved successfully.' });
        setGmailCredentials({ gmailApiKey: '', gmailClientId: '', gmailClientSecret: '', gmailRefreshToken: '' });
      } else {
        toast({ title: 'Failed', description: res?.error || 'Failed to save Gmail credentials', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || String(err), variant: 'destructive' });
    } finally {
      setSavingCreds(false);
    }
  };

  const handleSaveWhatsappCredentials = async (e?: any) => {
    e?.preventDefault?.();
    setSavingCreds(true);
    try {
      const uid = user?.uid || localStorage.getItem('userId');
      if (!uid) throw new Error('No user id');
      const res = await postJson(ENDPOINTS.whatsapp.save, { userId: uid, credentials: whatsappCredentials });
      if (res?.status === 'success') {
        setHasWhatsappCreds(true);
        saveCredentialFlag('whatsapp', uid);
        toast({ title: 'WhatsApp saved', description: 'WhatsApp credentials saved successfully.' });
        setWhatsappCredentials({ whatsappApiKey: '', whatsappPhoneNumberId: '', whatsappBusinessAccountId: '', whatsappAccessToken: '' });
      } else {
        toast({ title: 'Failed', description: res?.error || 'Failed to save WhatsApp credentials', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || String(err), variant: 'destructive' });
    } finally {
      setSavingCreds(false);
    }
  };

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
                    <AvatarImage src={user?.photoURL || ""} alt={user?.displayName || ""} />
                    <AvatarFallback className="text-3xl bg-gradient-to-br from-primary to-chart-2 text-primary-foreground">
                      {user?.displayName?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    size="icon"
                    className="absolute -bottom-2 -right-2 h-10 w-10 rounded-full shadow-lg bg-gradient-to-br from-primary to-chart-2 hover:scale-110 transition-transform duration-300"
                    onClick={() => console.log("Change avatar")}
                    data-testid="button-change-avatar"
                  >
                    <Camera className="h-5 w-5" />
                  </Button>
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

            <form className="grid gap-3" onSubmit={handleSaveGmailCredentials}>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="gmailClientId">Client ID</Label>
                  <Input id="gmailClientId" value={gmailCredentials.gmailClientId} onChange={(e) => setGmailCredentials({ ...gmailCredentials, gmailClientId: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="gmailClientSecret">Client Secret</Label>
                  <Input id="gmailClientSecret" type="password" value={gmailCredentials.gmailClientSecret} onChange={(e) => setGmailCredentials({ ...gmailCredentials, gmailClientSecret: e.target.value })} />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="gmailRefreshToken">Refresh Token</Label>
                  <Input id="gmailRefreshToken" type="password" value={gmailCredentials.gmailRefreshToken} onChange={(e) => setGmailCredentials({ ...gmailCredentials, gmailRefreshToken: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="gmailApiKey">API Key (optional)</Label>
                  <Input id="gmailApiKey" type="password" value={gmailCredentials.gmailApiKey} onChange={(e) => setGmailCredentials({ ...gmailCredentials, gmailApiKey: e.target.value })} />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-sm text-muted-foreground">Status: {hasGmailCreds ? <span className="text-green-600">Connected</span> : <span className="text-gray-500">Not connected</span>}</div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={savingCreds} className="bg-gradient-to-r from-primary to-chart-2">Save Gmail Credentials</Button>
                  <Button variant="ghost" onClick={() => setGmailCredentials({ gmailApiKey: '', gmailClientId: '', gmailClientSecret: '', gmailRefreshToken: '' })}>Clear</Button>
                </div>
              </div>
            </form>
          </div>
        </Card>

        {/* WhatsApp Credentials Card */}
        <Card className="p-8 backdrop-blur-xl bg-card/80 border-2 hover-elevate transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-250 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-chart-3/5 to-transparent rounded-lg -z-10" />
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-chart-3/20 to-chart-3/10 flex items-center justify-center">
                <Bell className="h-5 w-5 text-chart-3" />
              </div>
              <h2 className="text-2xl font-bold">WhatsApp Integration</h2>
            </div>

            <form className="grid gap-3" onSubmit={handleSaveWhatsappCredentials}>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="whatsappPhoneNumberId">Phone Number ID</Label>
                  <Input id="whatsappPhoneNumberId" value={whatsappCredentials.whatsappPhoneNumberId} onChange={(e) => setWhatsappCredentials({ ...whatsappCredentials, whatsappPhoneNumberId: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="whatsappBusinessAccountId">Business Account ID</Label>
                  <Input id="whatsappBusinessAccountId" value={whatsappCredentials.whatsappBusinessAccountId} onChange={(e) => setWhatsappCredentials({ ...whatsappCredentials, whatsappBusinessAccountId: e.target.value })} />
                </div>
              </div>

              <div>
                <Label htmlFor="whatsappAccessToken">Access Token</Label>
                <Input id="whatsappAccessToken" type="password" value={whatsappCredentials.whatsappAccessToken} onChange={(e) => setWhatsappCredentials({ ...whatsappCredentials, whatsappAccessToken: e.target.value })} />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-sm text-muted-foreground">Status: {hasWhatsappCreds ? <span className="text-green-600">Connected</span> : <span className="text-gray-500">Not connected</span>}</div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={savingCreds} className="bg-gradient-to-r from-chart-3 to-chart-4">Save WhatsApp Credentials</Button>
                  <Button variant="ghost" onClick={() => setWhatsappCredentials({ whatsappApiKey: '', whatsappPhoneNumberId: '', whatsappBusinessAccountId: '', whatsappAccessToken: '' })}>Clear</Button>
                </div>
              </div>
            </form>
          </div>
        </Card>

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

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="language" className="text-sm font-medium flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  Language
                </Label>
                <Input
                  id="language"
                  value={preferences.language}
                  onChange={(e) =>
                    setPreferences({ ...preferences, language: e.target.value })
                  }
                  data-testid="input-language"
                  className="transition-all duration-300 focus:ring-2 focus:ring-chart-3/50 bg-background/50"
                />
              </div>

              <Button 
                onClick={handleSavePreferences} 
                data-testid="button-save-preferences"
                className="bg-gradient-to-r from-chart-3 to-chart-4 hover:shadow-lg hover:shadow-chart-3/30 transition-all duration-300 hover:scale-[1.02]"
              >
                Save Preferences
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-8 border-2 border-destructive/30 bg-destructive/5 backdrop-blur-xl hover:border-destructive/50 transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-450 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-destructive/10 to-transparent rounded-lg -z-10" />
          
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-destructive/20 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-destructive">Danger Zone</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Irreversible actions that affect your account
                </p>
              </div>
            </div>
            
            <div className="p-5 rounded-xl bg-destructive/5 border border-destructive/20">
              <p className="text-sm text-muted-foreground mb-4">
                Once you delete your account, there is no going back. Please be certain.
              </p>
              <Button
                variant="destructive"
                onClick={() => console.log("Delete account")}
                data-testid="button-delete-account"
                className="hover:shadow-lg hover:shadow-destructive/30 transition-all duration-300"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Delete Account Permanently
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
