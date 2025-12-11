"use client";

import { Card, Badge } from "@/components/ui";
import { useAuthStore } from "@/lib/authStore";
import { useTheme } from "@/theme/ThemeProvider";

export default function ProfilePage() {
  const { theme } = useTheme();
  const user = useAuthStore((s) => s.user);

  return (
    <div style={{ display: "grid", gap: theme.spacing.lg, maxWidth: 720 }}>
      <Card title="Profile">
        <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.sm }}>
          <div style={{ display: "flex", gap: theme.spacing.sm, alignItems: "center" }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                backgroundColor: theme.colors.brandSoft,
                color: theme.colors.brandGrey,
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
              }}
            >
              {user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>{user?.name ?? user?.email}</p>
              <p style={{ margin: 0, color: theme.colors.textSecondary }}>{user?.email}</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: theme.spacing.sm, flexWrap: "wrap" }}>
            <Badge tone="brand">{user?.role ?? "User"}</Badge>
            {user?.two_factor_enabled ? <Badge tone="success">2FA enabled</Badge> : <Badge tone="warning">2FA disabled</Badge>}
          </div>
        </div>
      </Card>

      <Card title="Settings">
        <p style={{ margin: 0, color: theme.colors.textSecondary }}>
          Settings and preferences will appear here, including toggles for notifications and 2FA setup.
        </p>
      </Card>
    </div>
  );
}
