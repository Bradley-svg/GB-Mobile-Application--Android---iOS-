"use client";

import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { useOrgStore } from "@/lib/orgStore";
import { useUserRole } from "@/lib/useUserRole";
import { useTheme } from "@/theme/ThemeProvider";

export default function AdminPage() {
  const { theme } = useTheme();
  const router = useRouter();
  const { isOwner, isAdmin, isFacilities } = useUserRole();
  const { orgs, currentOrgId, setOrg } = useOrgStore();

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
      <p style={{ marginTop: 0, color: theme.colors.textSecondary }}>
        Switch organisations to view their fleet. This is read-only; server-side RBAC still applies.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.borderSubtle}` }}>
                Organisation
              </th>
              <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.borderSubtle}` }}>
                Sites
              </th>
              <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.borderSubtle}` }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((org) => (
              <tr key={org.id}>
                <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.borderSubtle}` }}>{org.name}</td>
                <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.borderSubtle}` }}>
                  {org.siteCount ?? "—"}
                </td>
                <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.borderSubtle}` }}>
                  <Button
                    size="sm"
                    variant={currentOrgId === org.id ? "primary" : "secondary"}
                    onClick={() => {
                      setOrg(org.id);
                      router.push("/app");
                    }}
                  >
                    View as
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
