"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { me } from "@/lib/api/authApi";
import { useAuthStore } from "@/lib/authStore";
import { useTheme } from "@/theme/ThemeProvider";

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const [isReady, setIsReady] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      await loadFromStorage();
      const state = useAuthStore.getState();
      if (!state.accessToken) {
        router.replace("/login");
        return;
      }
      if (!state.user) {
        try {
          const profile = await me();
          if (active) {
            setUser(profile);
          }
        } catch {
          logout();
          router.replace("/login");
          return;
        }
      }
      if (active) {
        setIsReady(true);
      }
    };

    void bootstrap();
    return () => {
      active = false;
    };
  }, [loadFromStorage, logout, router, setUser]);

  if (!isReady || !accessToken || !user) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.colors.background,
          color: theme.colors.textPrimary,
        }}
      >
        Loading your workspace...
      </div>
    );
  }

  return children;
}
