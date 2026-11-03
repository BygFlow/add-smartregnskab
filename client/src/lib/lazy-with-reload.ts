import { lazy as reactLazy, type ComponentType } from "react";

const CHUNK_RELOAD_KEY = "smartregnskab:chunk-reload";

function isChunkLoadFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk .* failed/i.test(message);
}

/**
 * Recovers once when a browser that was open during a deployment still points
 * at an old, fingerprinted JavaScript chunk. A successful import clears the
 * marker; a persistent failure is rethrown instead of causing a reload loop.
 */
export function lazyWithReload<T extends ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
) {
  return reactLazy(async () => {
    try {
      const module = await loader();
      if (typeof window !== "undefined") {
        try { window.sessionStorage.removeItem(CHUNK_RELOAD_KEY); } catch { /* storage can be disabled */ }
      }
      return module;
    } catch (error) {
      if (typeof window !== "undefined" && isChunkLoadFailure(error)) {
        try {
          const attempt = window.sessionStorage.getItem(CHUNK_RELOAD_KEY);
          const location = window.location.href;
          if (attempt !== location) {
            window.sessionStorage.setItem(CHUNK_RELOAD_KEY, location);
            window.location.reload();
            return await new Promise<{ default: T }>(() => undefined);
          }
        } catch {
          // If storage is unavailable, rethrow below so an error boundary can report it.
        }
      }
      throw error;
    }
  });
}
