import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip, Sparkles, Link } from "lucide-react";
import { cn } from "@/lib/utils";
import { Mic, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import useMicrophone from "@/hooks/use-microphone";
import type { ChatMessage } from "@shared/schema";

type Attachment = { name: string; mime: string; url: string };

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  investigateMode?: boolean;
  investigateType?: 'pdf' | 'url' | null;
}

export function ChatInput({ onSend, disabled, investigateMode, investigateType }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // speech recognition
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // microphone hook for recording & permission
  const { canRecord, permission: permissionState, isRecording, recordingMs, error: recordError, startRecording, stopRecording, requestPermission } = useMicrophone({
    onRecordingReady: (att) => setAttachments((s) => [...s, att]),
  });
  const { toast } = useToast();

  useEffect(() => {
    // setup Web Speech API if available
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) return;
    try {
      const r = new SpeechRecognition();
      r.continuous = false;
      r.interimResults = false;
      r.lang = 'en-US';
      r.onresult = (ev: any) => {
        const text = ev.results?.[0]?.[0]?.transcript;
        if (text) setMessage((m) => (m ? m + ' ' + text : text));
      };
      r.onend = () => setListening(false);
      recognitionRef.current = r;
    } catch (e) {
      console.warn('SpeechRecognition init failed', e);
    }
  }, []);

  useEffect(() => {
    // run diagnostics (log only)
    console.log('=== MICROPHONE DIAGNOSTICS ===');
    console.log('Protocol:', location.protocol);
    console.log('Hostname:', location.hostname);
    console.log('User Agent:', navigator.userAgent);
    console.log('MediaDevices available:', !!navigator.mediaDevices);
    console.log('getUserMedia available:', !!navigator.mediaDevices?.getUserMedia);
    console.log('MediaRecorder available:', typeof (window as any).MediaRecorder !== 'undefined');
    console.log('Microphone permission state:', permissionState);
  }, [permissionState]);

  const startListening = () => {
    const r = recognitionRef.current;
    if (!r) return;
    try {
      r.start();
      setListening(true);
    } catch (e) {
      console.warn('Speech start failed', e);
    }
  };

  const stopListening = () => {
    const r = recognitionRef.current;
    if (!r) return;
    try {
      r.stop();
      setListening(false);
    } catch (e) {
      console.warn('Speech stop failed', e);
    }
  };

  // recording handled via useMicrophone hook

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!disabled) {
      const payload: any = { message: message.trim(), attachments };
      if (message.trim() || attachments.length > 0) {
        onSend(JSON.stringify(payload));
        setMessage("");
        setAttachments([]);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const onFilesPicked = async (files?: FileList | null) => {
    if (!files || files.length === 0) return;
    const allowed = Array.from(files).filter((f) => {
      if (investigateMode && investigateType === 'pdf') {
        return f.type === 'application/pdf';
      }
      return f.type.startsWith('image/') || f.type === 'application/pdf';
    });
    const readPromises = allowed.map((f) => {
      return new Promise<Attachment>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({ name: f.name, mime: f.type, url: String(reader.result) });
        };
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });
    });
    try {
      const items = await Promise.all(readPromises);
      setAttachments((s) => [...s, ...items]);
    } catch (e) {
      console.warn('Failed to read files', e);
    }
  };

  const triggerFilePicker = () => fileInputRef.current?.click();

  return (
    <form onSubmit={handleSubmit} className="border-t bg-card/95 backdrop-blur-xl p-6 relative z-10 shadow-lg">
      <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none" />
      
      <div className={cn(
        "flex gap-3 items-end max-w-4xl mx-auto relative transition-all duration-300",
        isFocused && "scale-[1.01]"
      )}>
        <input 
      ref={fileInputRef} 
      type="file" 
      accept={investigateMode && investigateType === 'pdf' ? 'application/pdf' : 'image/*,application/pdf'} 
      multiple={!investigateMode} 
      className="hidden" 
      onChange={(e) => onFilesPicked(e.target.files)} 
    />
        {(!investigateMode || investigateType === 'pdf') && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 h-12 w-12 rounded-xl hover:bg-primary/10 hover:text-primary transition-all duration-300"
            data-testid="button-attach"
            onClick={triggerFilePicker}
          >
            <Paperclip className="h-5 w-5" />
          </Button>
        )}
        
        <div className="flex-1 relative">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Type your message..."
            className={cn(
              "min-h-[52px] max-h-32 resize-none rounded-2xl transition-all duration-300 pr-12 bg-background/80 backdrop-blur-sm",
              isFocused && "ring-2 ring-primary/50 shadow-lg shadow-primary/10"
            )}
            disabled={disabled}
            data-testid="input-message"
          />
          {message.length > 0 && (
            <div className="absolute bottom-3 right-3 text-xs text-muted-foreground animate-in fade-in duration-200">
              {message.length} chars
            </div>
          )}
        </div>
        <div className="flex flex-col items-start gap-2 absolute left-16 bottom-12 z-20">
          {attachments.map((a, i) => (
            <div key={i} className="flex items-center gap-2 bg-card/80 border p-2 rounded-md">
              {a.mime.startsWith('image/') ? (
                <img src={a.url} className="h-10 w-10 object-cover rounded-md" alt={a.name} />
              ) : (
                <div className="h-10 w-10 flex items-center justify-center bg-muted rounded-md text-xs">PDF</div>
              )}
              <div className="text-xs max-w-[200px] truncate">{a.name}</div>
              <button type="button" className="p-1 ml-2 text-muted-foreground" onClick={() => setAttachments((s) => s.filter((_, idx) => idx !== i))}>
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

          <div className="flex items-center gap-2">
            {/* URL input dialog - only show in URL mode */}
            {investigateMode && investigateType === 'url' && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => {
                  const url = window.prompt("Enter URL to analyze:");
                  if (url) {
                    setMessage((prev) => `${prev.trim() ? prev + '\n' : ''}${url}`);
                  }
                }}
                className="shrink-0 h-12 w-12 rounded-xl transition-all duration-300"
                title="Paste URL to analyze"
              >
                <Link className="h-5 w-5" />
              </Button>
            )}
            
            <Button
              type="button"
              size="icon"
              variant={isRecording ? "destructive" : "ghost"}
              onClick={() => (isRecording ? stopRecording() : startRecording())}
              className="shrink-0 h-12 w-12 rounded-xl transition-all duration-300"
              title={isRecording ? "Stop recording" : "Record voice"}
              data-testid="button-record"
              disabled={!canRecord || permissionState === 'denied'}
            >
              <Mic className={`h-5 w-5 ${isRecording ? 'animate-pulse' : ''}`} />
            </Button>          <Button
            type="submit"
            size="icon"
            disabled={!(message.trim() || attachments.length > 0) || disabled}
            className={cn(
              "shrink-0 h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-chart-2 hover:shadow-lg hover:shadow-primary/30 transition-all duration-300",
              (message.trim() || attachments.length > 0) && !disabled ? "scale-100 hover:scale-110" : "scale-95 opacity-50"
            )}
            data-testid="button-send"
          >
            {disabled ? (
              <Sparkles className="h-5 w-5 animate-pulse" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
      
      <div className="flex items-center justify-center gap-2 mt-3 text-xs text-muted-foreground">
        {isRecording ? (
          <>
            <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
            <span>Recording... {(Math.floor(recordingMs / 1000)).toString().padStart(1, '0')}s — click mic to stop</span>
          </>
        ) : (
          <>
            <Sparkles className="h-3 w-3" />
            <span>Press Enter to send, Shift+Enter for new line — attach images, PDFs, or record audio</span>
          </>
        )}
      </div>
      {recordError && (
        <div className="mt-2 text-center text-xs text-destructive/80">
          {recordError}
          {permissionState === 'denied' && (
            <div className="mt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={requestPermission}
                className="text-xs h-6 px-2"
              >
                Request Permission Again
              </Button>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
