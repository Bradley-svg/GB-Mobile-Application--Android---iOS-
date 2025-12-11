"use client";

import { ReactNode } from "react";

type ThemeProviderProps = {
  children: ReactNode;
};

// Placeholder provider to plug in the shared theming system later.
export function ThemeProvider({ children }: ThemeProviderProps) {
  return <>{children}</>;
}
