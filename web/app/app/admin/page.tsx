"use client";

import { Card } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { useUserRole } from "@/lib/useUserRole";

export default function AdminPage() {
  const { theme } = useTheme();
  const { isOwner, isAdmin, isFacilities } = useUserRole();
  const allowed = isOwner || isAdmin || isFacilities;

  if (!allowed) {
    return (
      <Card title="Access denied">
        <p style={{ margin: 0, color: theme.colors.textSecondary }}>
          You do not have permission to view admin tools. Contact an administrator if you believe this is an error.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Admin tools">
      <p style={{ margin: 0, color: theme.colors.textSecondary }}>
        Organisation settings, role management, and advanced controls will be available here.
      </p>
    </Card>
  );
}
