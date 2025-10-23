import { useEffect, useRef, useState } from 'react';

export type PermissionState = 'unknown' | 'granted' | 'denied' | 'prompt';

export type Attachment = { name: string; mime: string; url: string };

export function useMicrophone(options?: {
  onRecordingReady?: (att: Attachment) => void;
}) {
  const { onRecordingReady } = options || {};
  const [canRecord, setCanRecord] = useState(false);
  const [permission, setPermission] = useState<PermissionState>('unknown');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const recordingStartRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const supported = typeof window !== 'undefined' && 'mediaDevices' in navigator && !!navigator.mediaDevices?.getUserMedia && typeof (window as any).MediaRecorder !== 'undefined';
    setCanRecord(!!supported);

    // If Permissions API is available, query and listen for changes so the hook updates
    // immediately when the user allows/denies from the browser UI.
    let permStatus: PermissionStatus | null = null;
    if (supported && 'permissions' in navigator) {
      navigator.permissions.query({ name: 'microphone' as any }).then((r) => {
        permStatus = r;
        setPermission(r.state as any);
        // assign onchange handler to update state when user toggles permission in UI
        const handler = () => setPermission(r.state as any);
        try {
          r.onchange = handler;
        } catch {
          // In some browsers PermissionStatus may be read-only for onchange; ignore if so
        }
      }).catch(() => {
        setPermission('unknown');
      });
    }

    return () => {
      if (permStatus) {
        try { permStatus.onchange = null; } catch {}
        permStatus = null;
      }
    };
  }, []);

  // preferred mime types for MediaRecorder
  const PREFER = [ 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/mpeg' ];

  const startRecordingTimer = () => {
    recordingStartRef.current = Date.now();
    stopRecordingTimer();
    recordingTimerRef.current = window.setInterval(() => {
      if (recordingStartRef.current) setRecordingMs(Date.now() - recordingStartRef.current);
    }, 200);
  };
  const stopRecordingTimer = () => {
    if (recordingTimerRef.current !== null) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const _finalizeRecording = async (mediaRecorder: MediaRecorder) => {
    stopRecordingTimer();
    setRecordingMs(0);
    try {
      const blob = new Blob(recordedChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const ext = (blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp3') ? 'mp3' : blob.type.includes('mp4') ? 'm4a' : 'webm');
      const attachment: Attachment = { name: `voice-${new Date().toISOString()}.${ext}`, mime: blob.type || 'audio/webm', url: dataUrl };
      if (onRecordingReady) onRecordingReady(attachment);
      return attachment;
    } catch (e) {
      setError('Failed to save recording.');
      return null;
    }
  };

  const startRecording = async () => {
    if (isRecording) return;
    setError(null);
    if (!canRecord) {
      setError('Recording not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mrClass = (window as any).MediaRecorder as typeof MediaRecorder;
  const chosen = PREFER.find((t) => (mrClass as any).isTypeSupported?.(t));
      const mediaRecorder = new mrClass(stream, chosen ? { mimeType: chosen } : undefined);
      recordedChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        await _finalizeRecording(mediaRecorder);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      startRecordingTimer();
      setError(null);
    } catch (e: any) {
      setIsRecording(false);
      stopRecordingTimer();
      const name = e?.name;
      if (name === 'NotAllowedError') {
        setError('Microphone blocked by system. Check OS/browser privacy settings.');
        setPermission('denied');
      } else {
        setError((location.protocol !== 'https:' && location.hostname !== 'localhost') ? 'Microphone requires HTTPS or localhost.' : 'Recording failed.');
      }

      // fallback - try enumerating devices and request a specific deviceId (best-effort)
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices.filter((d) => d.kind === 'audioinput');
        for (const mic of mics) {
          try {
            const s = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: mic.deviceId } } });
            const mrClass2 = (window as any).MediaRecorder as typeof MediaRecorder;
            const chosen2 = PREFER.find((t) => (mrClass2 as any).isTypeSupported?.(t));
            const mediaRecorder = new mrClass2(s, chosen2 ? { mimeType: chosen2 } : undefined);
            recordedChunksRef.current = [];
            mediaRecorder.ondataavailable = (ev) => { if (ev.data && ev.data.size > 0) recordedChunksRef.current.push(ev.data); };
            mediaRecorder.onstop = async () => {
              await _finalizeRecording(mediaRecorder);
              s.getTracks().forEach((t) => t.stop());
            };
            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.start();
            setIsRecording(true);
            startRecordingTimer();
            setError(null);
            return;
          } catch (inner: any) {
            if (inner?.name === 'NotAllowedError') setPermission('denied');
            // continue to next device
          }
        }
      } catch {}
    }
  };

  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    try {
      if (mr.state !== 'inactive') mr.stop();
    } catch (e) {
      // ignore
    } finally {
      setIsRecording(false);
    }
  };

  const requestPermission = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermission('granted');
      stream.getTracks().forEach((t) => t.stop());
    } catch (e: any) {
      setPermission('denied');
      setError(e?.name === 'NotAllowedError' ? 'Microphone blocked by system. Check OS/browser privacy settings.' : 'Permission request failed.');
    }
  };

  return {
    canRecord,
    permission,
    isRecording,
    recordingMs,
    error,
    startRecording,
    stopRecording,
    requestPermission,
  } as const;
}

export default useMicrophone;
