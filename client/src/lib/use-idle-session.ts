import { useCallback, useEffect, useRef, useState } from "react";

export const CLIENT_IDLE_TIMEOUT_MS = 30 * 60_000;
export const CLIENT_IDLE_WARNING_MS = 2 * 60_000;
const KEEP_ALIVE_INTERVAL_MS = 5 * 60_000;

type IdleSessionOptions = {
  userId: number | null;
  logout: () => Promise<void>;
  keepAlive: () => Promise<void>;
};

export function useIdleSession({ userId, logout, keepAlive }: IdleSessionOptions) {
  const [warningSeconds, setWarningSeconds] = useState<number | null>(null);
  const continueRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (!userId) {
      setWarningSeconds(null);
      continueRef.current = () => undefined;
      return;
    }

    const storageKey = `add_sr_last_activity:${userId}`;
    let lastActivity = Date.now();
    let lastRecordedActivity = 0;
    let lastKeepAlive = Date.now();
    let warningActive = false;
    let warningTimer: ReturnType<typeof setTimeout> | undefined;
    let logoutTimer: ReturnType<typeof setTimeout> | undefined;
    let countdownTimer: ReturnType<typeof setInterval> | undefined;

    const clearTimers = () => {
      if (warningTimer) clearTimeout(warningTimer);
      if (logoutTimer) clearTimeout(logoutTimer);
      if (countdownTimer) clearInterval(countdownTimer);
      warningTimer = undefined;
      logoutTimer = undefined;
      countdownTimer = undefined;
    };

    const updateWarning = () => {
      const seconds = Math.max(0, Math.ceil((lastActivity + CLIENT_IDLE_TIMEOUT_MS - Date.now()) / 1000));
      setWarningSeconds(seconds);
    };

    const beginWarning = () => {
      warningActive = true;
      updateWarning();
      if (countdownTimer) clearInterval(countdownTimer);
      countdownTimer = setInterval(updateWarning, 1_000);
    };

    const expire = () => {
      clearTimers();
      warningActive = false;
      setWarningSeconds(null);
      void logout();
    };

    const schedule = () => {
      clearTimers();
      const remaining = lastActivity + CLIENT_IDLE_TIMEOUT_MS - Date.now();
      if (remaining <= 0) {
        expire();
        return;
      }
      if (remaining <= CLIENT_IDLE_WARNING_MS) beginWarning();
      else warningTimer = setTimeout(beginWarning, remaining - CLIENT_IDLE_WARNING_MS);
      logoutTimer = setTimeout(expire, remaining);
    };

    const pingServer = (force = false) => {
      const now = Date.now();
      if (!force && now - lastKeepAlive < KEEP_ALIVE_INTERVAL_MS) return;
      lastKeepAlive = now;
      void keepAlive().catch(() => undefined);
    };

    const markActivity = (force = false) => {
      if (warningActive && !force) return;
      const now = Date.now();
      if (!force && now - lastRecordedActivity < 1_000) return;
      lastRecordedActivity = now;
      lastActivity = now;
      warningActive = false;
      try { window.localStorage.setItem(storageKey, String(now)); } catch { /* privat tilstand */ }
      setWarningSeconds(null);
      pingServer(force);
      schedule();
    };

    const onActivity = () => markActivity(false);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey || !event.newValue) return;
      const remoteActivity = Number(event.newValue);
      if (!Number.isFinite(remoteActivity) || remoteActivity <= lastActivity) return;
      lastActivity = remoteActivity;
      lastRecordedActivity = remoteActivity;
      warningActive = false;
      setWarningSeconds(null);
      pingServer(false);
      schedule();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") schedule();
    };

    continueRef.current = () => markActivity(true);
    try { window.localStorage.setItem(storageKey, String(lastActivity)); } catch { /* privat tilstand */ }
    schedule();

    const activityEvents: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "wheel", "touchstart"];
    activityEvents.forEach((name) => window.addEventListener(name, onActivity, { passive: true }));
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearTimers();
      activityEvents.forEach((name) => window.removeEventListener(name, onActivity));
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
      continueRef.current = () => undefined;
    };
  }, [userId, logout, keepAlive]);

  const continueSession = useCallback(() => continueRef.current(), []);
  return { warningSeconds, continueSession };
}
