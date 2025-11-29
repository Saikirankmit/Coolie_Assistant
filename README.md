# Coolie Assistant

An AI-enabled assistant web app combining a React + Vite frontend with an Express + TypeScript server. The project integrates Firebase (auth & admin), Supabase, embedding providers (Cohere, Google, OpenAI), and a collection of helper scripts for diagnostics and embeddings.

This repository runs the server and client together in development: the server starts an Express API and mounts Vite in development so the front-end is served from the same port.

---

## Key Features
- Full-stack assistant UI built with React + Vite.
- Server (Express + TypeScript) providing API endpoints, OAuth flows, and integrations (YouTube, WhatsApp, PDF processing).
- Embeddings support with `cohere`, `google`, and `openai` providers.
- Playwright helpers and scraping utilities for web navigation and extraction.
- Supabase and Drizzle ORM for persistence and migrations.

---

## Repo layout (important files/folders)
- `client/` — React + Vite frontend sources (`src/` contains components, contexts, hooks, pages).
- `server/` — Express server and backend logic (routes, integrations, utils).
- `scripts/` — helper scripts (diagnostics, tests, model listing).
- `shared/` — shared types/schema used by client and server.
- `static/` — runtime-written static assets (Playwright screenshots, etc.).
- `supabase_migrations/` — SQL migrations for Supabase.

---

## Prerequisites
- Node.js 18+ (recommended). Ensure `node` and `npm` (or `pnpm`/`yarn`) are available.
- Recommended: install `tsx` globally or let the project `devDependencies` provide it.
- A Firebase service account JSON file (for `firebase-admin`), and required API keys for external providers.

---

## Environment variables

The project loads a root `.env` file. Do NOT commit secrets to version control. Below are the common variables used (redact and keep safe):

- `VITE_FIREBASE_API_KEY` — Firebase client key (frontend).
- `VITE_FIREBASE_APP_ID` — Firebase app id (frontend).
- `VITE_FIREBASE_PROJECT_ID` — Firebase project id.
- `FIREBASE_ADMIN_CREDENTIALS_PATH` — Path to a Firebase service account JSON file (server uses this to initialize `firebase-admin`).
- `FIREBASE_SERVICE_ACCOUNT_JSON` — (alternative) raw JSON string of service account.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI` — Google OAuth for sign-in.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase project connection.
- `EMBEDDING_PROVIDER` — `cohere` | `google` | `openai`.
- `COHERE_API_KEY` | `OPENAI_API_KEY` | `GOOGLE_AI_API_KEY` — Provider API keys.
- `YOUTUBE_API_KEY` — Optional for YouTube-related features.
- `PORT` — Port for the server (default: `5050`).

Example `.env` (placeholders):

```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CREDENTIALS_PATH=/absolute/path/to/service-account.json
SUPABASE_URL=https://your.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
EMBEDDING_PROVIDER=cohere
COHERE_API_KEY=your_cohere_key
OPENAI_API_KEY=your_openai_key
PORT=5050
```

Security note: avoid committing real keys. Use secret stores or environment config in deployment environments.

---

## Development (run locally)

The repository is configured so the server mounts Vite in development. Start the app with the command below from repository root.

1. Install dependencies

```powershell
npm install
```

2. Create a root `.env` with required keys and ensure `FIREBASE_ADMIN_CREDENTIALS_PATH` points to a valid JSON file.

3. Run the dev server (server + client together):

```powershell
npm run dev
```

This runs `tsx server/index.ts` (see `package.json`). The server starts on `PORT` (default `5050`) and in development it will set up Vite so you can open the app at `http://localhost:5050` (or use the Vite dev URL proxied by the server). The server will also accept requests from `http://localhost:5173` (common Vite port).

Useful scripts (from `package.json`):

- `npm run dev` — start the server in development (includes Vite middleware).
- `npm run build` — builds frontend with Vite and bundles the server with esbuild to `dist/`.
- `npm run start` — run the built server from `dist/` (expects production env).
- `npm run check` — runs TypeScript type-check (`tsc`).
- `npm run test-google-embed` / `npm run test-cohere-embed` — quick diagnostic scripts in `scripts/`.

---

## Build & Production

1. Build:

```powershell
npm run build
```

2. Start (after build):

```powershell
npm run start
```

The `build` step runs `vite build` for the client and bundles the server with `esbuild` to `dist/`. Ensure production environment variables are set (e.g., `FIREBASE_SERVICE_ACCOUNT_JSON` or `FIREBASE_ADMIN_CREDENTIALS_PATH`, `SUPABASE_SERVICE_ROLE_KEY`, API keys, `FRONTEND_URL`).

Deployment notes:
- The project contains a `Dockerfile` and `render.yaml` and `deploy-cloudrun.ps1` to help deploy to Cloud Run / Render. When deploying, set secrets in the target platform (do not push `.env`).

---

## Firebase Admin

The server requires Firebase Admin credentials at startup. You must provide one of:
- `FIREBASE_SERVICE_ACCOUNT_JSON` — the JSON content for the service account, or
- `FIREBASE_ADMIN_CREDENTIALS_PATH` — a filesystem path to the service account JSON.

The server attempts to resolve the path robustly (relative and absolute candidate paths).

If Firebase Admin is not initialized correctly, the server will fail to start.

---

## Embeddings and Providers

Set `EMBEDDING_PROVIDER` to the provider you wish to use (for example `cohere`). Provide the corresponding API key variable:
- `COHERE_API_KEY` for Cohere
- `OPENAI_API_KEY` for OpenAI
- `GOOGLE_AI_API_KEY` for Google

The project contains scripts and server-side adapters under `server/` and `server/gemini.ts`, `server/embeddingsAdapter.ts` which handle provider-specific behavior.

---

## Scripts & Debugging

- `npm run list-google-models` — helpful for enumerating Google models (script in `scripts/`).
- Diagnostic scripts are present in `scripts/` (e.g., `diagnose-google-embed.ts`). Use them to validate keys and embeddings.

---

## Contributing

- Follow the existing TypeScript + project style.
- When adding features that require new env vars, update `README.md` and add sensible defaults where appropriate.

---

## Security & Best Practices
- Keep secret keys out of the repo. Use platform secret stores (Cloud Run secrets, Render secrets, GitHub Actions secrets, etc.).
- Rotate keys if exposed.
- Limit service-role keys usage (prefer scoped API keys where possible).

---

## Contact / Credits

This project was organized by the repository owner. For questions about specific integrations, open an issue or reach out to the maintainer.
