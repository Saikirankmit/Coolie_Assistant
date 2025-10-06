import { ChatBubble } from "../ChatBubble";

export default function ChatBubbleExample() {
  const userMessage = {
    id: "1",
    content: "Hello! Can you help me organize my tasks for today?",
    role: "user" as const,
    timestamp: new Date(),
  };

  const assistantMessage = {
    id: "2",
    content:
      "Of course! I'd be happy to help you organize your tasks. Could you tell me what you need to accomplish today?",
    role: "assistant" as const,
    timestamp: new Date(Date.now() + 1000),
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <ChatBubble message={userMessage} userName="John Doe" />
      <ChatBubble message={assistantMessage} />
    </div>
  );
}
