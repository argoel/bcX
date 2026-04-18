import { defineConfig, loadEnv, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";

/* ────────────────────────────────────────────────────────────────────────
   Vite config — Root sandbox dev proxy.

   In "real" mode (VITE_USE_MOCK_ROOT=false) the browser calls our own
   `/api/root/*` routes.  Vite forwards them to Root's sandbox and
   injects the Authorization header from the server-side env var
   ROOT_SANDBOX_API_KEY — the secret never reaches the browser.

   For production you'd swap this dev proxy for a real backend (Express,
   Cloudflare Worker, Vercel function, …) doing the same injection.
   ──────────────────────────────────────────────────────────────────────── */

export default defineConfig(({ mode }) => {
  // Load .env / .env.local — note: ROOT_SANDBOX_API_KEY is intentionally
  // NOT prefixed with VITE_ so it stays server-side.
  const env = loadEnv(mode, process.cwd(), "");
  const secret = env.ROOT_SANDBOX_API_KEY;
  const target = env.ROOT_SANDBOX_BASE_URL || "https://sandbox.api.useroot.com";

  const rootProxy: ProxyOptions = {
    target,
    changeOrigin: true,
    secure: true,
    rewrite: (p) => p.replace(/^\/api\/root/, "/v1"),
    configure: (proxy) => {
      proxy.on("proxyReq", (proxyReq) => {
        if (secret) proxyReq.setHeader("Authorization", `Bearer ${secret}`);
      });
      proxy.on("error", (err) => {
        // Surface upstream errors to the terminal so misconfiguration is
        // obvious during development.
        console.error("[root-proxy]", err.message);
      });
    },
  };

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api/root": rootProxy,
      },
    },
  };
});
