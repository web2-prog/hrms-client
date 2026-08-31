# HRMS Frontend

React 19 + Vite + TypeScript UI for the HRMS system.

## Local Setup

```bash
npm install
cp .env.example .env   # defaults to http://localhost:5001/api
npm start              # http://localhost:3003 (same as npm run dev)
```

## Environment Variables

| Variable         | Description                                        |
|------------------|----------------------------------------------------|
| `VITE_API_URL`   | Backend API base URL, **must end with `/api`**     |

Local dev uses `http://localhost:5001/api`. For production, set `VITE_API_URL`
in the **Vercel dashboard** (Environment Variables) to the deployed backend URL,
e.g. `https://<your-backend-project>.vercel.app/api`.

## Vercel Deployment

This repo is configured for Vercel via `vercel.json`:

- Build command: `npm run build` (outputs to `dist`)
- All routes rewrite to `index.html` (SPA routing)

1. Import this repo into Vercel (framework auto-detected: **Vite**).
2. Add the `VITE_API_URL` environment variable (see above).
3. Deploy. The app will be live at `https://<your-project>.vercel.app`.

## Deep-link refreshes (SPA routing)

The app uses `BrowserRouter`, so the URL (e.g. `/admin/employees/123`) is real and
any server that hosts the frontend must fall back to `index.html` — otherwise
**refreshing a page returns a 4XX error**. This is configured for every host:

| Where | How it's handled |
|-------|------------------|
| `npm run dev` (port 3003) | Vite dev server — `appType: 'spa'` in `vite.config.ts` |
| `npm run preview` (port 4173) | Vite preview server — same `appType: 'spa'` fallback |
| Vercel | `vercel.json` → `rewrites` all paths to `/index.html` |
| Netlify | `public/_redirects` → `/* /index.html 200` |
| GitHub Pages / other static hosts | `dist/404.html` is generated at build time (copy of `index.html`), so a 404 response still boots the app at the current URL (works when the app is served from the domain root) |
| nginx | Add `try_files $uri $uri/ /index.html;` to the `location /` block |

If you serve `dist/` with any other static server, make sure it falls back to
`index.html` for unmatched paths (most SPA-aware servers do this via a
"history fallback" / "clean URLs" / `try_files` option).
