import { defineConfig, Plugin } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/**
 * Production-only Content-Security-Policy. Injected at build time rather than
 * living in index.html so the dev server (Vite HMR inline scripts) keeps
 * working. Locks scripts to same-origin, restricts network calls to Google's
 * Generative Language API, and blocks plugins/base-uri/form actions — raising
 * the cost of any future XSS exfiltrating secrets.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://generativelanguage.googleapis.com",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

const injectCspMeta = (): Plugin => ({
  name: "inject-csp-meta",
  apply: "build",
  transformIndexHtml(html) {
    return html.replace(
      "</head>",
      `  <meta http-equiv="Content-Security-Policy" content="${CSP}" />\n  </head>`,
    );
  },
});

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [dyadComponentTagger(), react(), injectCspMeta()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));