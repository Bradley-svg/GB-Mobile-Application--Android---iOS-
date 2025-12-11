"use client";

import {
  darkThemeTokens,
  lightThemeTokens,
  type ResolvedThemeMode,
  type ThemeMode,
  type ThemeTokens,
} from "@greenbro/ui-tokens";
import {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type ThemeContextValue = {
  theme: ThemeTokens;
  mode: ThemeMode;
  resolvedMode: ResolvedThemeMode;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: lightThemeTokens,
  mode: "light",
  resolvedMode: "light",
  setMode: () => undefined,
});

const getSystemMode = (): ResolvedThemeMode => {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export function ThemeProvider({
  children,
  defaultMode = "light",
}: PropsWithChildren<{ defaultMode?: ThemeMode }>) {
  const [mode, setMode] = useState<ThemeMode>(defaultMode);
  const [systemMode, setSystemMode] = useState<ResolvedThemeMode>(getSystemMode);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (event: MediaQueryListEvent) => setSystemMode(event.matches ? "dark" : "light");

    setSystemMode(media.matches ? "dark" : "light");
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  const resolvedMode: ResolvedThemeMode = mode === "system" ? systemMode : mode;
  const theme = resolvedMode === "dark" ? darkThemeTokens : lightThemeTokens;

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = resolvedMode;
    document.documentElement.style.backgroundColor = theme.colors.background;
    document.documentElement.style.color = theme.colors.textPrimary;
    document.documentElement.style.colorScheme = resolvedMode;
  }, [resolvedMode, theme]);

  const value = useMemo(
    () => ({
      mode,
      resolvedMode,
      theme,
      setMode,
    }),
    [mode, resolvedMode, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export type { ResolvedThemeMode, ThemeMode, ThemeTokens };
