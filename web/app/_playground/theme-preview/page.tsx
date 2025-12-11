"use client";

import { AppShell, Badge, Button, Card, StatusPill } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import type { ThemeTokens } from "@greenbro/ui-tokens";

const paletteOrder: Array<keyof ThemeTokens["colors"]> = [
  "background",
  "backgroundAlt",
  "surface",
  "surfaceAlt",
  "card",
  "primary",
  "primaryMuted",
  "brandGreen",
  "brandGreenMuted",
  "borderSubtle",
  "borderStrong",
  "textPrimary",
  "textSecondary",
  "textMuted",
  "success",
  "warning",
  "error",
  "info",
  "chartPrimary",
  "chartSecondary",
  "chartTertiary",
  "chartQuaternary",
];

function ColorSwatch({ name, value }: { name: string; value: string }) {
  const { theme } = useTheme();
  return (
    <div
      style={{
        border: `1px solid ${theme.colors.borderSubtle}`,
        borderRadius: theme.radius.md,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          backgroundColor: value,
          height: 64,
          borderBottom: `1px solid ${theme.colors.borderSubtle}`,
        }}
      />
      <div
        style={{
          padding: theme.spacing.sm,
          display: "flex",
          flexDirection: "column",
          gap: theme.spacing.xs,
          backgroundColor: theme.colors.surface,
        }}
      >
        <span style={{ fontWeight: theme.typography.subtitle.fontWeight }}>{name}</span>
        <span style={{ color: theme.colors.textSecondary, fontFamily: "monospace" }}>{value}</span>
      </div>
    </div>
  );
}

export default function ThemePreviewPage() {
  const { theme, mode, resolvedMode, setMode } = useTheme();

  return (
    <AppShell
      title="Theme Preview"
      navItems={[
        { label: "Dashboard" },
        { label: "Theme Preview", active: true },
        { label: "Settings" },
      ]}
      topActions={
        <div style={{ display: "flex", gap: theme.spacing.sm }}>
          <Badge tone="neutral">Mode: {mode}</Badge>
          <Badge tone="brand">Resolved: {resolvedMode}</Badge>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.lg }}>
        <Card title="Theme controls" subtitle="Toggle light/dark/system modes">
          <div style={{ display: "flex", gap: theme.spacing.sm, flexWrap: "wrap" }}>
            <Button variant={mode === "light" ? "primary" : "secondary"} onClick={() => setMode("light")}>
              Light
            </Button>
            <Button variant={mode === "dark" ? "primary" : "secondary"} onClick={() => setMode("dark")}>
              Dark
            </Button>
            <Button variant={mode === "system" ? "primary" : "secondary"} onClick={() => setMode("system")}>
              System
            </Button>
          </div>
        </Card>

        <div
          style={{
            display: "grid",
            gap: theme.spacing.lg,
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          }}
        >
          <Card title="Palette" subtitle="Core brand and surfaces">
            <div
              style={{
                display: "grid",
                gap: theme.spacing.sm,
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              }}
            >
              {paletteOrder.map((key) => (
                <ColorSwatch key={key} name={key} value={theme.colors[key]} />
              ))}
            </div>
          </Card>

          <Card title="Core components" subtitle="Button, Badge, Status">
            <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.md }}>
              <div style={{ display: "flex", gap: theme.spacing.sm, flexWrap: "wrap" }}>
                <Button variant="primary">Primary action</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
              </div>
              <div style={{ display: "flex", gap: theme.spacing.sm, flexWrap: "wrap" }}>
                <Badge tone="brand">Brand</Badge>
                <Badge tone="neutral">Neutral</Badge>
                <Badge tone="success">Success</Badge>
                <Badge tone="warning">Warning</Badge>
                <Badge tone="error">Error</Badge>
                <Badge tone="info">Info</Badge>
              </div>
              <div style={{ display: "flex", gap: theme.spacing.sm, flexWrap: "wrap" }}>
                <StatusPill status="online" />
                <StatusPill status="offline" />
                <StatusPill status="degraded" />
                <StatusPill status="unknown" />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
