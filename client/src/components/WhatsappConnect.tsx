import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export default function WhatsappConnect() {
  const { user, getIdToken } = useAuth();
  const { toast } = useToast();

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'idle'|'sent'|'verified'|'checking'>('idle');
  const [loading, setLoading] = useState(false);

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    try {
      if (typeof getIdToken === 'function') {
        const token = await getIdToken();
        if (token) return { Authorization: `Bearer ${token}` };
      }
    } catch (e) {}
    return {};
  };

  // normalize Indian numbers to +91XXXXXXXXXX and validate
  const normalizeIndianPhone = (input: string) => {
    const digits = (input || '').replace(/\D/g, '');
    let num = digits;
    if (num.length === 11 && num.startsWith('0')) num = num.slice(1);
    else if (num.length === 12 && num.startsWith('91')) num = num.slice(2);
    if (/^[6-9]\d{9}$/.test(num)) return `+91${num}`;
    return null;
  };

  useEffect(() => {
    (async () => {
      try {
        const headers = await getAuthHeaders();
  const resp = await fetch('/api/integrations/status', { headers });
        if (resp.ok) {
          const body = await resp.json().catch(() => ({}));
          if (body && body.whatsapp) setStage('verified');
        }
      } catch (e) {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendVerification = async () => {
    if (!phone) return toast({ title: 'Phone required', description: 'Enter a phone number (10-digit Indian mobile)', variant: 'destructive' });
    const normalized = normalizeIndianPhone(phone);
    if (!normalized) return toast({ title: 'Invalid Indian number', description: 'Phone must be a 10-digit Indian mobile number starting with 6-9', variant: 'destructive' });
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const uid = user?.uid || localStorage.getItem('userId');
      const fetchHeaders: Record<string, string> = { 'Content-Type': 'application/json', ...headers };
      const resp = await fetch('/api/whatsapp/verify', { method: 'POST', headers: fetchHeaders, body: JSON.stringify({ phoneNumber: normalized, userId: uid }) });
      const body = await resp.json().catch(() => ({}));
      if (resp.ok) {
        setStage('sent');
        // In dev mode the server returns debugCode when WA_TOKEN isn't configured.
        if (body?.debugCode) {
          // prefill the code field to make testing easier
          setCode(body.debugCode);
          toast({ title: 'Code (dev)', description: `Verification code (dev): ${body.debugCode}` });
          console.log('Debug verification code:', body.debugCode);
        } else {
          toast({ title: 'Code sent', description: 'A verification code was sent to your phone.' });
        }
      } else {
        toast({ title: 'Failed', description: body?.error || 'Failed to send verification', variant: 'destructive' });
      }
    } catch (err: any) {
      console.error('sendVerification error', err);
      toast({ title: 'Error', description: String(err), variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const confirmCode = async () => {
    if (!code) return toast({ title: 'Code required', description: 'Enter the verification code you received', variant: 'destructive' });
    setLoading(true);
    try {
  const headers = await getAuthHeaders();
  const uid = user?.uid || localStorage.getItem('userId');
  const fetchHeaders: Record<string, string> = { 'Content-Type': 'application/json', ...headers };
  const resp = await fetch('/api/whatsapp/confirm', { method: 'POST', headers: fetchHeaders, body: JSON.stringify({ userId: uid, code }) });
      const body = await resp.json().catch(() => ({}));
      if (resp.ok && body.status === 'verified') {
        setStage('verified');
        toast({ title: 'Verified', description: 'WhatsApp number verified and connected.' });
      } else {
        toast({ title: 'Failed', description: body?.error || 'Invalid code', variant: 'destructive' });
      }
    } catch (err: any) {
      console.error('confirmCode error', err);
      toast({ title: 'Error', description: String(err), variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const disconnect = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const fetchHeaders: Record<string, string> = { 'Content-Type': 'application/json', ...headers };
      // Call dedicated WhatsApp disconnect endpoint which removes number, messages and stored credentials
      const resp = await fetch('/api/integrations/disconnect-whatsapp', { method: 'POST', headers: fetchHeaders });
      const body = await resp.json().catch(() => ({}));
      if (resp.ok) {
        setStage('idle');
        toast({ title: 'Disconnected', description: 'WhatsApp disconnected and local data removed.' });
      } else {
        toast({ title: 'Failed to disconnect', description: body?.error || 'Failed to disconnect WhatsApp', variant: 'destructive' });
      }
    } catch (err: any) {
      console.error('disconnect error', err);
      toast({ title: 'Error', description: String(err), variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="p-4 bg-card/80 border rounded-md">
      <h3 className="text-lg font-bold">WhatsApp</h3>
      {stage === 'verified' ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">WhatsApp is connected. Only one number can be connected per user.</p>
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" disabled={loading}>Disconnect WhatsApp</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Disconnect WhatsApp</DialogTitle>
                <DialogDescription>Are you sure you want to disconnect WhatsApp? This will remove your connected number and messages from the system.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={async () => { setConfirmOpen(false); await disconnect(); }} disabled={loading}>Disconnect</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <Label htmlFor="wa-phone">Phone number</Label>
            <Input id="wa-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1415..." />
          </div>
          {stage === 'sent' && (
            <div>
              <Label htmlFor="wa-code">Verification code</Label>
              <Input id="wa-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
              <div className="pt-2 flex gap-2">
                <Button onClick={confirmCode} disabled={loading}>Confirm Code</Button>
                <Button variant="ghost" onClick={() => setStage('idle')}>Cancel</Button>
              </div>
            </div>
          )}
          {stage !== 'sent' && (
            <div className="pt-2 flex gap-2">
              <Button onClick={sendVerification} disabled={loading}>Send Verification Code</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
