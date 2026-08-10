# HRMS Frontend

React 19 + Vite + TypeScript UI for the HRMS system.

## Local Setup

```bash
npm install
cp .env.example .env   # defaults to http://localhost:5001/api
npm run dev            # http://localhost:3003
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
