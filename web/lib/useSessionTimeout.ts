"use client";

import { useEffect, useRef, useState } from "react";
import { SESSION_ABSOLUTE_TIMEOUT_MS, SESSION_IDLE_TIMEOUT_MS } from "@/config/session";
import { useAuthStore } from "@/lib/authStore";

export type SessionExpireReason = "idle" | "absolute";

export function useSessionTimeout(onExpire?: (reason: SessionExpireReason) => void) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const sessionStartedAt = useAuthStore((s) => s.sessionStartedAt);
  const lastActiveAt = useAuthStore((s) => s.lastActiveAt);
  const recordActivity = useAuthStore((s) => s.recordActivity);
  const [expiredReason, setExpiredReason] = useState<SessionExpireReason | null>(null);
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;
    setExpiredReason(null);
  }, [sessionStartedAt, accessToken]);

  useEffect(() => {
    if (!accessToken || !hasHydrated) return undefined;

    const handleActivity = () => {
      if (document.visibilityState === "hidden") return;
      recordActivity();
    };

    const events: Array<keyof DocumentEventMap> = [
      "mousemove",
      "keydown",
      "click",
      "touchstart",
      "scroll",
      "visibilitychange",
    ];

    events.forEach((event) => document.addEventListener(event, handleActivity));
    const interval = window.setInterval(() => {
      if (expiredRef.current) return;
      const now = Date.now();
      const absoluteStart = sessionStartedAt ?? lastActiveAt ?? now;
      const idleAnchor = lastActiveAt ?? absoluteStart;

      if (SESSION_ABSOLUTE_TIMEOUT_MS && now - absoluteStart > SESSION_ABSOLUTE_TIMEOUT_MS) {
        expiredRef.current = true;
        setExpiredReason("absolute");
        onExpire?.("absolute");
        return;
      }

      if (SESSION_IDLE_TIMEOUT_MS && now - idleAnchor > SESSION_IDLE_TIMEOUT_MS) {
        expiredRef.current = true;
        setExpiredReason("idle");
        onExpire?.("idle");
      }
    }, 15000);

    return () => {
      events.forEach((event) => document.removeEventListener(event, handleActivity));
      window.clearInterval(interval);
    };
  }, [accessToken, hasHydrated, lastActiveAt, onExpire, recordActivity, sessionStartedAt]);

  return expiredReason;
}
