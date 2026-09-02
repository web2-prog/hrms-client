import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';

// The app uses BrowserRouter (client-side routing), so EVERY server that hosts
// the build must fall back to index.html for unknown paths — otherwise a page
// refresh on a deep route (e.g. /admin/employees/123) returns a 4XX.
//
// Coverage:
//  - Dev server (`npm run dev`)   -> appType 'spa' (explicit below)
//  - Preview server (`vite preview`) -> appType 'spa' enables the fallback
//  - Vercel  -> rewrites in vercel.json
//  - Netlify -> public/_redirects
//  - Other static hosts (GitHub Pages, Surge, ...) -> dist/404.html generated
//    by the plugin below, so a 404 response still boots the SPA at the URL.
function spa404Fallback(): Plugin {
  let outDir = 'dist';
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    configResolved(config) {
      // Vite resolves this to an absolute path relative to config.root.
      outDir = config.build.outDir;
    },
    closeBundle() {
      // Rollup calls this after the bundle is written; index.html exists here.
      const source = path.join(outDir, 'index.html');
      const target = path.join(outDir, '404.html');
      if (fs.existsSync(source)) {
        fs.copyFileSync(source, target);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), spa404Fallback()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },


  // 'spa' (the Vite default) turns on HTML history fallback on both the dev
  // and preview servers: any GET that doesn't match a real asset is served
  // index.html. Kept explicit so this behavior can never silently change.
  appType: 'spa',

  // The app is served from the domain root (Vercel / Netlify / nginx at /).
  base: '/',

  server: {
      port: 6004,
      host: "127.0.0.1",
    // Bind to 0.0.0.0 so the dev server is also reachable over the LAN.
    // Fail fast with a clear error instead of silently moving to a random port
    // (a port drift is a common cause of "nothing works after refresh").
    strictPort: true,
  },

  preview: {
    port: 6005,
    host: "127.0.0.1",
    allowedHosts: ["hrms.kriraai.com","*"]
  },

  build: {
    outDir: 'dist',
  },
});
