import { useEffect, useRef, useState } from "react";
import { ChatBubble } from "@/components/ChatBubble";
import { TypingIndicator } from "@/components/TypingIndicator";
import { ChatInput } from "@/components/ChatInput";
import { useAuth } from "@/contexts/AuthContext";
import { useChat } from "@/contexts/ChatContext";
import { Button } from "@/components/ui/button";
import { Trash2, Sparkles, PlusCircle, Archive, Search, MessageSquare, Link } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

const WEBHOOK_URL = import.meta.env.VITE_CLIENT_WEBHOOK_URL || "/api/webhook/proxy";

export default function Chat() {
  const { user, getIdToken } = useAuth();
  const {
    messages,
    addMessage,
    clearMessages,
    isTyping,
    setIsTyping,
    conversations,
    newConversation,
    loadConversation,
    deleteConversation,
    currentConversationId,
  } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInvestigateMode, setIsInvestigateMode] = useState(false);
  const [investigateType, setInvestigateType] = useState<'pdf' | 'url' | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const toggleChatMode = () => {
    if (isInvestigateMode) {
      // Switching to normal mode
      setIsInvestigateMode(false);
      setInvestigateType(null);
    } else {
      // Show option dialog when switching to investigate mode
      const type = window.prompt('Select investigation type (pdf/url):')?.toLowerCase();
      if (type === 'pdf' || type === 'url') {
        setIsInvestigateMode(true);
        setInvestigateType(type);
      }
    }
  };

  const handleSendMessage = async (content: string) => {
    // ChatInput may send structured payloads (JSON) containing message and attachments.
    let messageText = content;
    let attachments: any = undefined;
    let url: string | undefined;

    // allow building a prebuilt payload for investigate URL mode so sending goes through the same path
    let prebuiltPayload: any = null;
    try {
      // Only send webhook for user messages and only if message was created recently (< 2 minutes)
      const now = Date.now();
      // Handle investigate mode payload
      if (isInvestigateMode) {
        if (investigateType === 'url') {
          const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;
          const urlMatch = messageText.match(urlRegex);
          if (!urlMatch) {
            setError("Please provide a valid URL in investigate URL mode");
            return;
          }

          // Create payload and defer sending to the shared send logic below
          prebuiltPayload = {
            message: messageText.trim(),
            url: urlMatch[0],
            userName: user?.displayName || "Anonymous",
            userId: user?.uid,
            investigateMode: true,
            investigateType: 'url'
          };

          // don't return here; we'll use prebuiltPayload later to send via the common path
        }

        if (investigateType === 'pdf' && (!attachments || attachments.length === 0)) {
          setError("Please attach a PDF file in investigate PDF mode");
          return;
        }
      }

  // Always try the YouTube endpoint - it will use Gemini to detect video intents
  // Track whether this message was handled locally (video opened) to avoid duplicate webhook calls
  let handled = false;
  try {
        let token: string | null = null;
        try {
          token = typeof getIdToken === 'function' ? (await getIdToken()) : null;
        } catch (e) {
          console.warn('Failed to get id token for youtube open', e);
          token = null;
        }

        const resp = await fetch('/api/youtube/open', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ query: messageText }),
        });
        
        if (resp.ok) {
          const json = await resp.json();

          // If it's a video request with high confidence, handle it
          if (json?.status === 'success' && json.isVideoRequest && json.confidence > 0.7 && json.video?.url) {
            const { video, searchQuery } = json;

            // Try opening the video. We'll attempt multiple methods to reduce false 'blocked' reports.
            const handledVideo = { opened: false, url: video.url } as { opened: boolean; url: string };

            // First attempt: window.open (preferred)
            try {
              const videoWindow = window.open(video.url, '_blank', 'noopener,noreferrer');
              if (videoWindow) {
                handledVideo.opened = true;
                try { videoWindow.focus(); } catch (e) { /* ignore focus errors */ }
              }
            } catch (e) {
              console.warn('window.open threw when trying to open video:', e);
            }

            // Second attempt: programmatic anchor click (works in some browsers/contexts)
            if (!handledVideo.opened) {
              try {
                const a = document.createElement('a');
                a.href = video.url;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                // Some browsers require the element to be in the document to allow opening
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                // We can't reliably detect success, but if no exception thrown assume it opened
                handledVideo.opened = true;
              } catch (e) {
                console.warn('Programmatic anchor click failed to open video:', e);
                handledVideo.opened = false;
              }
            }

            // Craft assistant message: include fallback link only when both methods indicate failure
            const assistantMsg = {
              id: (Date.now() + 1).toString(),
              content: handledVideo.opened
                ? `📺 I found a video that matches your request!\n\nTitle: ${video.title}\nChannel: ${video.channel}\n\nI've opened it in a new tab for you.`
                : `📺 I found a video that matches your request!\n\nTitle: ${video.title}\nChannel: ${video.channel}\n\nI couldn't open a new tab (likely blocked by your browser). You can open it here: ${video.url}`,
              role: 'assistant' as const,
              timestamp: new Date(),
            };

            addMessage(assistantMsg);
            setIsTyping(false);
            handled = true;
            // Stop further processing (don't send webhook) since we've handled the video
            return;
          }
          
          // If we got here, either:
          // 1. Not a video request (continue with normal chat)
          // 2. Low confidence (continue with normal chat)
          // 3. No video found (continue with normal chat)
        }
      } catch (e) {
        console.warn('YouTube/video handling failed:', e);
        // Continue with normal chat flow on error
      }

      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object' && 'message' in parsed) {
        messageText = String(parsed.message ?? "");
        attachments = parsed.attachments;
      }
    } catch (e) {
      // not JSON; treat content as plain text
    }

    let payload: any;
    
    if (isInvestigateMode && investigateType === 'pdf') {
      payload = {
        message: messageText,
        userName: user?.displayName || "Anonymous",
        userId: user?.uid,
        investigateMode: true,
        investigateType: 'pdf',
        files: attachments
      };
    } else {
      // Regular chat mode
      payload = {
        message: messageText,
        userName: user?.displayName || "Anonymous",
        userId: user?.uid,
      };
    }

    const userMessage = {
      id: Date.now().toString(),
      content: messageText,
      role: "user" as const,
      timestamp: new Date(),
      attachments: !isInvestigateMode ? attachments : undefined,
    };

    addMessage(userMessage);
    setIsTyping(true);
    setError(null);

    try {
      // prepare request
      const hasAudio = Array.isArray(attachments) && attachments.some((a: any) => typeof a?.mime === 'string' && a.mime.startsWith('audio/'));

      const dataUrlToBlob = (dataUrl: string): Blob => {
        const [meta, base64] = dataUrl.split(',');
        const mimeMatch = /data:(.*?);base64/.exec(meta || '');
        const mime = mimeMatch?.[1] || 'application/octet-stream';
        const binStr = atob(base64 || '');
        const len = binStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binStr.charCodeAt(i);
        return new Blob([bytes], { type: mime });
      };

  let response: Response;
  let didSendWebhook = false;
  let data: any = null;
  let rawText: string | null = null;
      // Ensure this handler only triggers the external webhook for recent user messages
      // userMessage.timestamp was just created above so this should normally pass; this
      // protects against delayed/replicated sends where the webhook should not be invoked.
      const now = Date.now();
      const sentAt = userMessage.timestamp instanceof Date ? userMessage.timestamp.getTime() : now;
      const twoMinutes = 2 * 60 * 1000;
      if ((now - sentAt) > twoMinutes) {
        console.debug('Message too old to send to webhook (skipping)', { now, sentAt });
      } else {
      // QUICK-PATH: try website opener before sending to external webhook.
      // Only run this quick-path for explicit website-opening requests or when a URL is present.
      // This prevents generic statements from triggering site opens (e.g., "I am a student in cbit").
      const shouldTrySiteQuickPath = (() => {
        if (!messageText || typeof messageText !== 'string') return false;
        const t = messageText.trim().toLowerCase();
        // Quick URL checks
        if (/https?:\/\//.test(t) || /\bwww\./.test(t)) return true;
        // Explicit action phrases that indicate the user wants to open/visit a site
        const triggers = [
          'open',
          'go to',
          'visit',
          'show me',
          'navigate to',
          'launch',
          'open website',
          'open the website',
          'open site',
          'visit site',
          'open link'
        ];
        for (const ph of triggers) {
          if (t.includes(ph)) return true;
        }
        return false;
      })();

      let handled = false;
      if (shouldTrySiteQuickPath) {
        try {
          const siteResp = await apiFetch('/api/website/open', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: messageText }),
          });
          if (siteResp.ok) {
            const siteJson = await siteResp.json();
            // If we get any indication of success from the website endpoint, don't forward to webhook
            const success = siteJson?.status === 'success' || 
                           siteJson?.opened_in_system_browser || 
                           siteJson?.opened ||
                           siteJson?.final_url ||
                           siteJson?.data?.screenshot_url;
            
            if (success) {
              handled = true;
              // If the server returned a final URL, open it in the user's browser (client-side)
              if (siteJson?.final_url) {
                try {
                  const w = window.open(siteJson.final_url, '_blank', 'noopener,noreferrer');
                  if (w) try { w.focus(); } catch (e) { /* ignore */ }
                } catch (e) {
                  console.warn('window.open failed for site quick-path', e);
                }
                const assistantMsg = {
                  id: (Date.now() + 1).toString(),
                  content: `🌐 I found the website you're looking for!\n\n${
                    siteJson?.data?.title 
                      ? `Title: ${siteJson.data.title}\n` 
                      : ''
                  }${
                    siteJson?.data?.description 
                      ? `Description: ${siteJson.data.description}\n` 
                      : ''
                  }\nI've opened it in a new tab for you. (${siteJson.final_url})`,
                  role: 'assistant' as const,
                  timestamp: new Date(),
                };
                addMessage(assistantMsg);
                setIsTyping(false);
                return; // handled — don't forward to webhook
              }
              // If the tool returned a screenshot URL, show a message with link
              if (siteJson?.data?.screenshot_url) {
                const assistantMsg = {
                  id: (Date.now() + 1).toString(),
                  content: `🌐 I found and captured the website for you!\n\n${
                    siteJson?.data?.title 
                      ? `Title: ${siteJson.data.title}\n` 
                      : ''
                  }${
                    siteJson?.data?.description 
                      ? `Description: ${siteJson.data.description}\n` 
                      : ''
                  }\nHere's a screenshot of the page: ${siteJson.data.screenshot_url}`,
                  role: 'assistant' as const,
                  timestamp: new Date(),
                };
                addMessage(assistantMsg);
                setIsTyping(false);
                return; // handled
              }
            }
          }
        } catch (e) {
          // ignore and fall back to webhook forwarding
          console.warn('Website quick-path failed:', e);
        }

        // Don't proceed with webhook if website was handled successfully
        if (handled) {
          setIsTyping(false);
          return;
        }
      }
        // If we built a prebuiltPayload (URL investigate) use it directly and send as JSON
        if (prebuiltPayload) {
        console.debug("Sending prebuilt JSON webhook POST to", WEBHOOK_URL, "payload:", prebuiltPayload);
        response = await fetch(WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(prebuiltPayload),
        });
        didSendWebhook = true;
      } else if (hasAudio) {
        const form = new FormData();
        form.append('message', messageText);
        if (user?.uid) form.append('userId', String(user.uid));
        if (user?.displayName) form.append('userName', String(user.displayName));

        // attach files: send all attachments as files for consistency
        if (Array.isArray(attachments)) {
          attachments.forEach((a: any, idx: number) => {
            try {
              if (typeof a?.url === 'string' && a.url.startsWith('data:')) {
                const blob = dataUrlToBlob(a.url);
                const file = new File([blob], a?.name || `attachment-${idx}`, { type: a?.mime || blob.type || 'application/octet-stream' });
                form.append('files', file, file.name);
              } else if (typeof a?.url === 'string') {
                // Non data-URL; include as JSON field for server to fetch if needed
                form.append(`attachment_${idx}_url`, a.url);
                if (a?.mime) form.append(`attachment_${idx}_mime`, a.mime);
                if (a?.name) form.append(`attachment_${idx}_name`, a.name);
              }
            } catch (e) {
              console.warn('Failed to append attachment', a, e);
            }
          });
        }

        console.debug("Sending multipart webhook POST to", WEBHOOK_URL);
        response = await fetch(WEBHOOK_URL, {
          method: 'POST',
          body: form,
        });
        didSendWebhook = true;
      } else {
        // For investigate modes do not include attachments in the JSON payload
        const jsonPayload: any = {
          message: messageText,
          userId: user?.uid,
          userName: user?.displayName || "Anonymous",
        };
        if (!isInvestigateMode) jsonPayload.attachments = attachments ?? undefined;

        console.debug("Sending JSON webhook POST to", WEBHOOK_URL, "payload:", jsonPayload);
        response = await fetch(WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(jsonPayload),
        });
        didSendWebhook = true;
      }
    }

      if (!didSendWebhook) {
        // No webhook was sent (message was too old); treat as no response
        data = null;
        rawText = null;
      } else {
        // We did send a webhook and have a response object
        if (!response!) {
          // defensive: if response is somehow missing, treat as no content
          data = null;
          rawText = null;
        } else {
          if (!response!.ok) {
            let errorBody: string | undefined;
            try {
              const json = await response!.json();
              errorBody = JSON.stringify(json);
            } catch (e) {
              try {
                errorBody = await response!.text();
              } catch (e) {
                errorBody = undefined;
              }
            }
            const message = `HTTP error! status: ${response!.status}${errorBody ? ` - ${errorBody}` : ""}`;
            throw new Error(message);
          }

          // Try to read response as text first, then parse JSON if possible.
          try {
            rawText = await response!.text();
            try {
              data = rawText ? JSON.parse(rawText) : rawText;
            } catch (e) {
              data = rawText;
            }
          } catch (e) {
            console.warn('Failed to read response body', e);
            data = null;
            rawText = null;
          }
        }
      }

        // If in investigate mode and a URL was sent, add a visual indicator
        if (url) {
          messageText = `🔗 Analyzing URL: ${url}\n${messageText}`;
        }      // Derive assistant content from common fields or fallbacks
      let assistantContent = "I received your message!";
      let assistantModel: string | undefined = undefined;

      // helper to extract message string from an object, including nested JSON strings
      const extractText = (obj: any): string | null => {
        if (obj === null || obj === undefined) return null;
        // if it's a string that looks like JSON, try parse it
        if (typeof obj === 'string') {
          const s = obj.trim();
          if (!s) return null;
          if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
            try {
              const parsed = JSON.parse(s);
              return extractText(parsed);
            } catch (e) {
              return s;
            }
          }
          return s;
        }
        if (typeof obj === 'object') {
          // common fields
          const keys = ['output', 'response', 'message', 'reply', 'text', 'result', 'answer', 'body', 'data'];
          // try direct keys (case-sensitive)
          for (const k of keys) {
            const v = obj[k];
            if (typeof v === 'string' && v.trim()) return v.trim();
            if (Array.isArray(v) && v.length > 0) {
              const first = v[0];
              const extracted = extractText(first);
              if (extracted) return extracted;
            }
          }
          // try case-insensitive keys
          const lowerMap: Record<string, any> = {};
          for (const kk of Object.keys(obj)) {
            lowerMap[kk.toLowerCase()] = (obj as any)[kk];
          }
          for (const k of keys) {
            const v = lowerMap[k.toLowerCase()];
            if (typeof v === 'string' && v.trim()) return v.trim();
            if (Array.isArray(v) && v.length > 0) {
              const first = v[0];
              const extracted = extractText(first);
              if (extracted) return extracted;
            }
          }
          // OpenAI-like
          const choices = obj.choices;
          if (Array.isArray(choices) && choices.length > 0) {
            const first = choices[0];
            const textFromChoice = first?.text || first?.message?.content || first?.delta?.content || first?.output?.text;
            if (typeof textFromChoice === 'string' && textFromChoice.trim()) return textFromChoice.trim();
            const deep = extractText(first);
            if (deep) return deep;
          }
          // also if object looks like an array-like container (has 0 key)
          if ('0' in obj) {
            const maybe = (obj as any)[0];
            const deep = extractText(maybe);
            if (deep) return deep;
          }
        }
        return null;
      };

      // If response is an array like [{"output":"..."}] or ['{"output":"..."}'] prefer the first element
      let top: any = data;
      if (Array.isArray(data) && data.length > 0) {
        const first = data[0];
        if (typeof first === 'string') {
          try {
            top = JSON.parse(first);
          } catch (e) {
            top = first;
          }
        } else {
          top = first;
        }
      }
      const txt = extractText(top);
      if (txt) assistantContent = txt;

      // try to capture model info from various fields
      if (top && typeof top === 'object') {
        assistantModel = top.model || top.modelName || top.engine || top.provider || top.source || undefined;
        if (!assistantModel && Array.isArray(top.choices) && top.choices[0]) {
          assistantModel = top.choices[0].model || top.choices[0].engine || assistantModel;
        }
      }

  // fallback to rawText if we still don't have content
      if ((!assistantContent || assistantContent === 'I received your message!') && rawText && rawText.trim()) {
        // try JSON parse then extract
        try {
          const parsedRaw = JSON.parse(rawText);
          const candidate = extractText(Array.isArray(parsedRaw) ? parsedRaw[0] : parsedRaw);
          if (candidate) assistantContent = candidate;
          else assistantContent = String(parsedRaw);
        } catch (e) {
          // regex fallback: look for "output" or "message" fields inside rawText
          const rx = /"(?:output|message|response)"\s*:\s*"([\s\S]*?)"/i;
          const m = rx.exec(rawText);
          if (m && m[1]) {
            // unescape simple escaped quotes and newlines
            assistantContent = m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
          } else {
            assistantContent = rawText.trim();
          }
        }
      }

      // If the webhook indicates it handled the message (e.g., handled: 'youtube'), skip adding its response
      try {
        const maybeHandled = (typeof data === 'object' && data && (data.handled || (Array.isArray(data) && data[0]?.handled))) || (typeof rawText === 'string' && rawText.includes('"handled"'));
        if (maybeHandled) {
          // If the webhook already returned the youtube video object, we prefer the client-side handling (which already showed the video)
          console.debug('Webhook response indicated handled action, skipping assistant message to avoid duplicate');
          return;
        }
      } catch (e) {
        // ignore errors in handled detection
      }

      // If we still ended up with the default message, fall back to rawText or a JSON dump so user sees something useful.
      if (assistantContent === 'I received your message!') {
        try {
          const fallback = (rawText && rawText.trim()) || (data ? JSON.stringify(data) : undefined) || (top ? JSON.stringify(top) : undefined) || '';
          if (fallback && fallback.trim()) {
            assistantContent = String(fallback).trim();
          } else {
            // final fallback: explicit empty-response note
            assistantContent = '(empty response)';
          }
        } catch (e) {
          assistantContent = '(empty response)';
        }
        console.warn('Unable to extract structured assistant text; showing raw payload for debugging. rawText:', rawText, 'data:', data, 'top:', top);
      }

      // normalize whitespace/newlines (strip trailing newlines)
      if (typeof assistantContent === 'string') {
        assistantContent = assistantContent.replace(/\n+$/g, '').trim();
      }

      const assistantMessage: any = {
        id: (Date.now() + 1).toString(),
        content: assistantContent,
        role: "assistant" as const,
        timestamp: new Date(),
      };
      if (assistantModel) assistantMessage.model = assistantModel;
      // Avoid adding noisy empty responses
      if (assistantMessage.content && assistantMessage.content !== '(empty response)') {
        addMessage(assistantMessage);
      } else {
        console.debug('Filtered out empty assistant response');
      }
    } catch (err) {
      console.error("Error sending message:", err);
      const friendly = "Server unreachable — please check your connection and try again.";
      setError(friendly);

      const errorMessage = {
        id: (Date.now() + 1).toString(),
        content: friendly,
        role: "assistant" as const,
        timestamp: new Date(),
      };
      addMessage(errorMessage);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="h-full flex bg-gradient-to-br from-background via-primary/5 to-chart-2/5 relative">
      <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none" />
      <aside className="w-80 border-r bg-card/70 backdrop-blur-xl p-4 z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-chart-2 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Chats</h2>
              <p className="text-xs text-muted-foreground">Conversation history</p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => newConversation()}>
            <PlusCircle className="h-4 w-4 mr-2" /> New
          </Button>
        </div>

        <div className="space-y-2 overflow-auto max-h-[70vh]">
          {conversations.length === 0 && (
            <div className="text-sm text-muted-foreground p-3">No conversations yet. Click New to start.</div>
          )}
          {conversations.map((c) => (
            <div
              key={c.id}
              className={`flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-primary/5 ${currentConversationId === c.id ? 'bg-primary/5' : ''}`}
              onClick={() => loadConversation(c.id)}
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-md bg-secondary/10 flex items-center justify-center text-sm font-medium">{c.title?.charAt(0) ?? 'C'}</div>
                <div className="text-sm">
                  <div className="font-medium truncate max-w-[180px]">{c.title || 'New chat'}</div>
                  <div className="text-xs text-muted-foreground">{new Date(c.updatedAt).toLocaleString()}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}>
                  <Archive className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <div className="border-b bg-card/80 backdrop-blur-xl p-6 relative z-10 shadow-sm">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-chart-2 flex items-center justify-center shadow-lg shadow-primary/20">
                <Sparkles className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent" data-testid="text-page-title">
                  Chat with Coolie
                </h1>
                <p className="text-sm text-muted-foreground">Your AI assistant is here to help</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearMessages}
                  data-testid="button-clear-chat"
                  className="hover:bg-destructive/10 hover:text-destructive transition-all duration-300"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Chat
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleChatMode}
                data-testid="button-chat-mode"
              >
                {isInvestigateMode ? (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    {investigateType === 'pdf' ? 'PDF Mode' : 'URL Mode'}
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Chat Mode
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 relative z-10">
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.length === 0 && (
              <div className="text-center py-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="mb-6 inline-flex">
                  <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/20 to-chart-2/20 flex items-center justify-center">
                    <Sparkles className="h-10 w-10 text-primary" />
                  </div>
                </div>
                <h3 className="text-2xl font-semibold mb-2">Start a Conversation</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Ask Coolie anything! I'm here to help you with tasks, questions, and much more.
                </p>
                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
                  <div className="p-4 rounded-xl bg-card border hover:border-primary/50 transition-all duration-300 cursor-pointer hover:shadow-lg group">
                    <p className="text-sm font-medium group-hover:text-primary transition-colors">What can you help me with?</p>
                  </div>
                  <div className="p-4 rounded-xl bg-card border hover:border-primary/50 transition-all duration-300 cursor-pointer hover:shadow-lg group">
                    <p className="text-sm font-medium group-hover:text-primary transition-colors">Show me my tasks for today</p>
                  </div>
                </div>
              </div>
            )}
            {messages.map((message) => (
              <ChatBubble
                key={message.id}
                message={message}
                userName={user?.displayName || "You"}
                userAvatar={user?.photoURL || ""}
              />
            ))}
            {isTyping && <TypingIndicator />}
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-4 rounded-xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                <p className="font-medium">Connection Error</p>
                <p className="text-xs mt-1 opacity-80">{error}</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <ChatInput 
          onSend={handleSendMessage} 
          disabled={isTyping} 
          investigateMode={isInvestigateMode}
          investigateType={investigateType}
        />
      </main>
    </div>
  );
}
