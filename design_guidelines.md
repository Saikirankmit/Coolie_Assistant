# Coolie Personal AI Assistant - Design Guidelines

## Design Approach
**Selected Approach:** Design System with Modern Productivity Focus

Drawing inspiration from Linear's clean aesthetics, ChatGPT's conversational interface, and Notion's personalization features. This creates a professional, efficiency-focused experience optimized for AI interaction and task management.

**Core Principles:**
- Clarity over decoration - every element serves a purpose
- Conversational flow - chat interface feels natural and responsive
- Information hierarchy - critical actions and data are immediately accessible
- Professional polish - enterprise-ready appearance with consumer-friendly UX

---

## Color Palette

**Dark Mode (Primary):**
- Background Primary: 220 15% 8%
- Background Secondary: 220 15% 12%
- Background Tertiary: 220 15% 16%
- Primary Brand: 220 90% 56% (vibrant blue for AI personality)
- Text Primary: 220 10% 98%
- Text Secondary: 220 10% 70%
- Border Subtle: 220 15% 22%
- Success: 145 65% 50%
- Warning: 35 90% 60%
- Error: 0 75% 58%

**Light Mode:**
- Background Primary: 0 0% 100%
- Background Secondary: 220 20% 97%
- Background Tertiary: 220 20% 94%
- Primary Brand: 220 90% 50%
- Text Primary: 220 20% 15%
- Text Secondary: 220 15% 45%
- Border Subtle: 220 15% 88%

**Accent Colors:**
- AI Response Highlight: 260 60% 55% (purple for assistant messages)
- Task Priority High: 0 75% 58%
- Task Priority Medium: 35 90% 60%
- Task Priority Low: 145 65% 50%

---

## Typography

**Font Families:**
- Primary: 'Inter', system-ui, sans-serif (body text, UI elements)
- Monospace: 'JetBrains Mono', monospace (code blocks, technical content)

**Hierarchy:**
- Hero Heading: 48px, 700 weight, -0.02em tracking
- Page Heading: 32px, 600 weight, -0.01em tracking
- Section Heading: 24px, 600 weight
- Card Title: 18px, 500 weight
- Body: 15px, 400 weight, 1.6 line-height
- Small Text: 13px, 400 weight
- Caption: 12px, 400 weight

---

## Layout System

**Spacing Primitives:** Use Tailwind units 2, 4, 6, 8, 12, 16 for consistency
- Component padding: p-4 to p-6
- Section spacing: py-12 to py-16
- Card gaps: gap-4 to gap-6
- Icon-text spacing: gap-2 to gap-3

**Container Strategy:**
- Max-width: max-w-7xl for main content areas
- Chat interface: max-w-4xl centered for optimal reading
- Sidebar: 280px fixed width on desktop
- Mobile: full-width with px-4 padding

**Grid Patterns:**
- Task cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Settings options: single column with max-w-2xl
- Dashboard widgets: grid-cols-1 lg:grid-cols-2

---

## Component Library

**Navigation:**
- Persistent sidebar on desktop (collapsed on mobile to hamburger menu)
- Active state: subtle background with left border accent
- Icons from Heroicons (outline style for inactive, solid for active)

**Chat Interface:**
- User messages: Right-aligned, primary brand background, rounded-2xl
- AI messages: Left-aligned, tertiary background, rounded-2xl
- Message spacing: space-y-4
- Typing indicator: Three animated dots in AI message bubble
- Input area: Fixed bottom with backdrop blur, border-t divider

**Buttons:**
- Primary: Filled with brand color, rounded-lg, px-6 py-3
- Secondary: Outlined with border-2, same padding
- Ghost: No background, hover shows subtle bg
- Icon buttons: p-2, rounded-lg, 40x40px touch target

**Forms & Inputs:**
- Text fields: Background tertiary, border subtle, rounded-lg, p-3
- Focus state: Primary brand ring-2
- Labels: Text secondary, 13px, mb-2
- Helper text: Caption size below input

**Task Cards:**
- Border: border subtle, rounded-xl
- Padding: p-4
- Header: Flex between title and priority badge
- Priority badges: Rounded-full, px-3 py-1, small text with matching background
- Hover: Subtle shadow and background lightening

**Modals:**
- Backdrop: 220 15% 8% with 60% opacity
- Content: Background secondary, rounded-2xl, max-w-lg
- Padding: p-6
- Close button: Top-right, ghost style

---

## Page-Specific Guidelines

**Home Page:**
- Hero section with greeting and quick stats (tasks pending, unread messages)
- Quick action cards for "Start Chat" and "View Tasks" - 2 column grid
- Recent activity feed below
- No large hero image - focus on functional dashboard

**Chat Page:**
- Clean, distraction-free interface
- Messages container with scroll, pb-24 for input clearance
- Attachment preview thumbnails inline with messages
- Timestamp subtle, 12px below each message group

**Task Page:**
- Filter tabs at top (All, Gmail, WhatsApp, Reminders)
- Active filter: Primary brand background
- Task cards in responsive grid
- Empty state: Centered illustration with encouraging message

**Personalization Engine:**
- Form-based interface with sections: Tone, Formality, Response Length
- Toggle switches and radio groups for preferences
- Live preview panel showing sample AI response
- Save button: Primary, sticky at bottom on mobile

**Settings Page:**
- Section navigation on left (Profile, Privacy, Preferences, Account)
- Content area with clear section headings
- Avatar upload with preview
- Danger zone for account deletion at bottom with error color

---

## Animations

**Subtle Transitions:**
- Page transitions: 200ms ease-in-out
- Hover states: 150ms ease
- Chat message appearance: Fade up 300ms
- Typing indicator: Pulse animation on dots

**Strategic Motion:**
- Task completion: Check animation with success color
- Message send: Slide up and fade
- Modal open/close: Scale and fade 250ms

---

## Responsive Behavior

**Breakpoints:**
- Mobile: < 768px - Stack all layouts, full-width cards, bottom nav
- Tablet: 768px - 1024px - 2-column grids, visible sidebar
- Desktop: > 1024px - Full layout with persistent sidebar, 3-column grids

**Mobile Optimizations:**
- Chat input: Sticky with safe-area-inset-bottom
- Navigation: Bottom tab bar with icons only
- Task cards: Full width with clear tap targets (min 44px)
- Forms: Stack labels above inputs with adequate spacing