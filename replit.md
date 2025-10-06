# Coolie - Personal AI Assistant

## Overview

Coolie is a personal AI assistant application with context retention capabilities. The application features a conversational chat interface, task management system, and personalization options. Built with a modern tech stack, it provides an intelligent assistant experience with support for Gmail, WhatsApp, and reminder-based task tracking.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System:**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server
- Wouter for lightweight client-side routing
- TanStack Query (React Query) for server state management

**UI Component System:**
- Shadcn/ui component library with Radix UI primitives
- Tailwind CSS for styling with custom design tokens
- Class Variance Authority (CVA) for component variant management
- Custom theme system supporting light, dark, and system modes

**Design Philosophy:**
The application follows a modern productivity-focused design inspired by Linear, ChatGPT, and Notion. The color palette uses HSL values with dark mode as primary, featuring a vibrant blue primary brand color (220 90% 56%) and purple accent for AI responses (260 60% 55%). Typography uses Inter as the primary font family.

**State Management:**
- Context API for cross-cutting concerns (Auth, Theme, Chat)
- React hooks for local component state
- Firebase Authentication for user session management

### Backend Architecture

**Server Framework:**
- Express.js as the Node.js web framework
- TypeScript for type safety across the stack
- HTTP server created via Node's native `http` module

**Development Setup:**
- Vite middleware integration for HMR in development
- Custom logging middleware for API request tracking
- Error handling middleware for standardized error responses

**API Design:**
- RESTful API endpoints prefixed with `/api`
- Webhook proxy endpoint (`/api/webhook/proxy`) for forwarding messages to n8n automation workflows
- Storage interface abstraction with in-memory implementation (MemStorage)

**Data Layer:**
- Drizzle ORM configured for PostgreSQL (via @neondatabase/serverless)
- Schema-first approach with Zod validation via drizzle-zod
- Database migrations managed in `./migrations` directory
- In-memory storage fallback for development/testing

### External Dependencies

**Authentication & User Management:**
- Firebase Authentication for user sign-up, sign-in, and session management
- Email/password authentication with display name support

**Database:**
- PostgreSQL (configured via Drizzle, ready for Neon serverless deployment)
- Connection managed through DATABASE_URL environment variable

**Automation & Webhooks:**
- n8n workflow automation platform integration
- Webhook endpoint configured via N8N_WEBHOOK_URL or VITE_N8N_WEBHOOK_URL
- Message forwarding to WhatsApp MCP workflows

**Third-Party Libraries:**
- date-fns for date manipulation
- nanoid for unique ID generation
- embla-carousel-react for carousel functionality
- cmdk for command palette implementation

**Build & Development Tools:**
- esbuild for server-side bundling
- Replit-specific plugins for development environment integration
- PostCSS with Autoprefixer for CSS processing

### Database Schema

**Core Tables:**
- `users`: User authentication and profile data (id, username, password)

**Type Definitions (Client-Side):**
- `ChatMessage`: Conversational messages with role-based differentiation
- `Task`: Task management with type categorization (gmail, whatsapp, reminder) and priority levels
- `PersonalizationSettings`: AI behavior customization (tone, response length, formality, emoji preferences)
- `UserPreferences`: Application preferences (theme, notifications, language)

### Authentication Flow

1. User credentials stored via Firebase Authentication
2. Session state managed through Firebase onAuthStateChanged listener
3. Protected routes enforce authentication via ProtectedRoute component wrapper
4. User context provided globally through AuthContext

### Integration Points

**Chat System:**
- Messages sent to configured n8n webhook endpoint
- User messages include userId and userName metadata
- Response handling with typing indicators and error states

**Task Management:**
- Tasks categorized by source (Gmail, WhatsApp, Reminder)
- Priority levels (low, medium, high) with visual indicators
- Completion tracking and due date support