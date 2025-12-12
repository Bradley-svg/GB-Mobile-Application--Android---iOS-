import "@testing-library/jest-dom";
import React from "react";
import { vi } from "vitest";

if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

type ResponsiveContainerProps = {
  width?: number;
  height?: number;
  children?: ((size: { width: number; height: number }) => React.ReactNode) | React.ReactNode;
};

vi.mock("recharts", async () => {
  const actual = (await vi.importActual<typeof import("recharts")>("recharts")) as typeof import("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ width = 800, height = 400, children }: ResponsiveContainerProps) =>
      React.createElement(
        "div",
        { style: { width, height } },
        typeof children === "function" ? children({ width, height }) : children,
      ),
  };
});
