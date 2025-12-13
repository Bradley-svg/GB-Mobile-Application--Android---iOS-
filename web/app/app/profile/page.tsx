"use client";

import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card } from "@/components/ui";
import {
  confirmTwoFactor,
  disableTwoFactor,
  listAuthSessions,
  revokeAuthSession,
  revokeOtherAuthSessions,
  setupTwoFactor,
} from "@/lib/api/authApi";
import { useAuthStore } from "@/lib/authStore";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import type { AuthSession, AuthUser } from "@/lib/types/auth";
import { AUTH_2FA_ENABLED, getAuth2faEnforcedRoles } from "@/config/env";
import { useOrgStore } from "@/lib/orgStore";
import { useUserRole } from "@/lib/useUserRole";
import { useTheme } from "@/theme/ThemeProvider";
import QRCode from "qrcode";

type SetupStep = "idle" | "loading" | "ready" | "verifying" | "verified";

const parseErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as { message?: string } | undefined)?.message ?? fallback;
  }
  return fallback;
};

type TwoFactorSectionProps = {
  user: AuthUser;
  onUserUpdate: (user: AuthUser) => void;
};

export function TwoFactorSection({ user, onUserUpdate }: TwoFactorSectionProps) {
  const { theme } = useTheme();
  const [step, setStep] = useState<SetupStep>("idle");
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isDisabling, setIsDisabling] = useState(false);

  const twoFactorEnabled = Boolean(user.two_factor_enabled);
  const role = user.role?.toLowerCase() ?? "";
  const isEnforced = getAuth2faEnforcedRoles().includes(role);
  const twoFactorFeatureEnabled = AUTH_2FA_ENABLED;

  useEffect(() => {
    let active = true;
    if (!otpauthUrl) {
      setQrDataUrl(null);
      return () => {
        active = false;
      };
    }
    QRCode.toDataURL(otpauthUrl, { width: 220, margin: 1 })
      .then((url: string) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl(null);
      });

    return () => {
      active = false;
    };
  }, [otpauthUrl]);

  const requestSetup = async () => {
    if (step === "loading" || step === "verifying") return;
    setError(null);
    setCode("");
    setStep("loading");
    setSecret(null);
    setOtpauthUrl(null);
    setQrDataUrl(null);
    try {
      const setup = await setupTwoFactor();
      setSecret(setup.secret);
      setOtpauthUrl(setup.otpauthUrl ?? null);
      setStep("ready");
    } catch (err) {
      setError(parseErrorMessage(err, "Could not start 2FA setup."));
      setStep("idle");
    }
  };

  const confirmSetup = async () => {
    setError(null);
    setStep("verifying");
    try {
      await confirmTwoFactor(code.trim());
      onUserUpdate({ ...user, two_factor_enabled: true });
      setStep("verified");
    } catch (err) {
      setError(parseErrorMessage(err, "Invalid code. Try again."));
      setStep("ready");
    }
  };

  const handleDisable = async () => {
    if (isEnforced) return;
    const acknowledged = typeof window !== "undefined" ? window.confirm("Disable two-factor authentication for this account?") : true;
    if (!acknowledged) return;
    setIsDisabling(true);
    setError(null);
    try {
      await disableTwoFactor();
      onUserUpdate({ ...user, two_factor_enabled: false });
      setStep("idle");
      setSecret(null);
      setOtpauthUrl(null);
      setQrDataUrl(null);
      setCode("");
    } catch (err) {
      setError(parseErrorMessage(err, "Could not disable two-factor authentication."));
    } finally {
      setIsDisabling(false);
    }
  };

  if (!twoFactorFeatureEnabled) {
    return (
      <Card title="Two-factor authentication" subtitle="Use an authenticator app to protect sign-in.">
        <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.sm }}>
          <div style={{ display: "flex", gap: theme.spacing.sm, flexWrap: "wrap", alignItems: "center" }}>
            <Badge tone={twoFactorEnabled ? "success" : "warning"} data-testid="2fa-status">
              {twoFactorEnabled ? "2FA enabled" : "2FA disabled"}
            </Badge>
            <Badge tone="neutral">Disabled by backend</Badge>
          </div>
          <p style={{ margin: 0, color: theme.colors.textSecondary }}>
            Two-factor authentication is turned off for this environment. Web controls are hidden to match the backend.
          </p>
        </div>
      </Card>
    );
  }

  const showSetup = step !== "idle";
  const canSubmitCode = code.trim().length >= 6 && (step === "ready" || step === "verified" || step === "verifying");

  return (
    <Card title="Two-factor authentication" subtitle="Use an authenticator app to protect sign-in.">
      <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.md }}>
        <div style={{ display: "flex", gap: theme.spacing.sm, flexWrap: "wrap", alignItems: "center" }}>
          <Badge tone={twoFactorEnabled ? "success" : "warning"} data-testid="2fa-status">
            {twoFactorEnabled ? "2FA enabled" : "2FA disabled"}
          </Badge>
          {isEnforced ? (
            <Badge tone="warning" data-testid="2fa-enforced-badge">
              Required for {role || "this role"}
            </Badge>
          ) : (
            <Badge tone="neutral">Optional</Badge>
          )}
        </div>

        {error ? (
          <div
            style={{
              border: `1px solid ${theme.colors.error}`,
              background: theme.colors.errorSoft,
              color: theme.colors.error,
              borderRadius: theme.radius.md,
              padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
            }}
            data-testid="twofactor-error"
          >
            {error}
          </div>
        ) : null}

        {!twoFactorEnabled ? (
          <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.sm }}>
            <p style={{ margin: 0, color: theme.colors.textSecondary }}>
              Secure your account with a 6-digit code from an authenticator app. {isEnforced ? "This role must keep 2FA on." : ""}
            </p>
            <Button onClick={requestSetup} disabled={step === "loading"} data-testid="enable-2fa-button">
              {step === "loading" ? "Preparing..." : isEnforced ? "Enable now (required)" : "Enable two-factor authentication"}
            </Button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.sm }}>
            <p style={{ margin: 0, color: theme.colors.textSecondary }}>
              Keep your authenticator handy. If you need to rotate devices, open setup to generate a fresh QR.
            </p>
            <div style={{ display: "flex", gap: theme.spacing.sm, flexWrap: "wrap" }}>
              <Button variant="secondary" size="sm" onClick={requestSetup} disabled={step === "loading"} data-testid="regen-2fa-button">
                {step === "loading" ? "Refreshing..." : "Show setup"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisable}
                disabled={isEnforced || isDisabling}
                data-testid="disable-2fa-button"
              >
                {isEnforced ? "Enforced by policy" : isDisabling ? "Disabling..." : "Disable two-factor authentication"}
              </Button>
            </div>
          </div>
        )}

        {showSetup ? (
          <div
            style={{
              border: `1px solid ${theme.colors.borderSubtle}`,
              borderRadius: theme.radius.lg,
              padding: theme.spacing.md,
              background: theme.colors.surfaceAlt,
              display: "grid",
              gap: theme.spacing.md,
            }}
            data-testid="twofactor-wizard"
          >
            <div style={{ display: "grid", gap: theme.spacing.xs }}>
              <div style={{ display: "flex", alignItems: "center", gap: theme.spacing.xs }}>
                <Badge tone="info">Step 1</Badge>
                <strong>Scan or add the key</strong>
              </div>
              {step === "loading" ? (
                <p style={{ margin: 0, color: theme.colors.textSecondary }}>Requesting your secret...</p>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(160px, 220px) 1fr",
                    gap: theme.spacing.md,
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      width: 220,
                      height: 220,
                      borderRadius: theme.radius.md,
                      border: `1px dashed ${theme.colors.borderSubtle}`,
                      background: theme.colors.card,
                      display: "grid",
                      placeItems: "center",
                      overflow: "hidden",
                    }}
                  >
                    {qrDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={qrDataUrl} alt="Authenticator QR code" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    ) : (
                      <span style={{ color: theme.colors.textSecondary, textAlign: "center", padding: theme.spacing.sm }}>
                        QR will appear once the secret loads.
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.xs }}>
                    <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>Secret</span>
                    <code
                      data-testid="twofactor-secret"
                      style={{
                        padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
                        borderRadius: theme.radius.md,
                        border: `1px solid ${theme.colors.borderSubtle}`,
                        background: theme.colors.background,
                        letterSpacing: 1,
                        fontWeight: 700,
                        width: "100%",
                        display: "inline-block",
                        boxSizing: "border-box",
                      }}
                    >
                      {secret ?? "Generating..."}
                    </code>
                    <p style={{ margin: 0, color: theme.colors.textSecondary }}>
                      Add this key to Google Authenticator, 1Password, or any TOTP app. Keep it private.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "grid", gap: theme.spacing.xs }}>
              <div style={{ display: "flex", alignItems: "center", gap: theme.spacing.xs }}>
                <Badge tone="info">Step 2</Badge>
                <strong>Confirm the 6-digit code</strong>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.xs }}>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  data-testid="twofactor-code-input"
                  style={{
                    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
                    borderRadius: theme.radius.md,
                    border: `1px solid ${theme.colors.borderSubtle}`,
                    background: theme.colors.background,
                    letterSpacing: 4,
                    textAlign: "center",
                    fontWeight: 600,
                  }}
                />
                <div style={{ display: "flex", gap: theme.spacing.sm, flexWrap: "wrap", alignItems: "center" }}>
                  <Button onClick={confirmSetup} disabled={!canSubmitCode || step === "verifying"}>
                    {step === "verifying" ? "Verifying..." : "Confirm 2FA"}
                  </Button>
                  {step === "verified" ? (
                    <Badge tone="success" data-testid="twofactor-success">
                      Two-factor is active
                    </Badge>
                  ) : null}
                  {step === "verified" ? (
                    <Button variant="ghost" size="sm" onClick={() => setStep("idle")}>
                      Close setup
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

type SessionsPanelProps = {
  currentUserEmail?: string | null;
};

function SessionsPanel({ currentUserEmail }: SessionsPanelProps) {
  const { theme } = useTheme();
  const [sessions, setSessions] = useState<AuthSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const data = await listAuthSessions();
        if (active) {
          setSessions(data);
          setNotice(null);
        }
      } catch {
        if (active) {
          setNotice("Session list is coming soon. Showing placeholder entries.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const revokeOne = async (sessionId: string) => {
    setRevokingId(sessionId);
    try {
      await revokeAuthSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } finally {
      setRevokingId(null);
    }
  };

  const revokeOthers = async () => {
    setRevokingOthers(true);
    try {
      await revokeOtherAuthSessions();
      setSessions((prev) => prev.filter((s) => s.current));
    } finally {
      setRevokingOthers(false);
    }
  };

  const rows = sessions.map((session) => {
    const friendlyDevice = session.userAgent || "Unknown device";
    const created = formatRelativeTime(session.createdAt, "Unknown");
    const lastUsed = formatRelativeTime(session.lastUsedAt, "Unknown");
    return (
      <div
        key={session.id}
        data-testid={`session-${session.id}`}
        style={{
          border: `1px solid ${theme.colors.borderSubtle}`,
          borderRadius: theme.radius.md,
          padding: theme.spacing.md,
          background: theme.colors.card,
          display: "flex",
          flexDirection: "column",
          gap: theme.spacing.xs,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: theme.spacing.sm }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <strong>{friendlyDevice}</strong>
            <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>
              IP: {session.ip ?? "Unknown"}
            </span>
          </div>
          {session.current ? (
            <Badge tone="brand">This session</Badge>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => revokeOne(session.id)} disabled={revokingId === session.id}>
              {revokingId === session.id ? "Signing out..." : "Sign out"}
            </Button>
          )}
        </div>
        <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>
          Created {created} • Last used {lastUsed}
        </span>
        {currentUserEmail ? (
          <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>
            User: {currentUserEmail}
          </span>
        ) : null}
      </div>
    );
  });

  const hasOtherSessions = sessions.some((s) => !s.current);

  return (
    <Card title="Active sessions" subtitle="Review signed-in devices and revoke stray logins.">
      <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.sm }}>
        {notice ? (
          <div
            style={{
              border: `1px dashed ${theme.colors.borderSubtle}`,
              background: theme.colors.surfaceAlt,
              padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
              borderRadius: theme.radius.md,
              color: theme.colors.textSecondary,
            }}
          >
            {notice}
          </div>
        ) : null}

        {loading ? (
          <p style={{ margin: 0, color: theme.colors.textSecondary }}>Loading sessions...</p>
        ) : sessions.length === 0 ? (
          <p style={{ margin: 0, color: theme.colors.textSecondary }}>No active sessions found.</p>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gap: theme.spacing.sm,
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              }}
            >
              {rows}
            </div>
            {hasOtherSessions ? (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Button variant="ghost" size="sm" onClick={revokeOthers} disabled={revokingOthers} data-testid="revoke-others-button">
                  {revokingOthers ? "Signing out others..." : "Sign out all other sessions"}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </Card>
  );
}

export default function ProfilePage() {
  const { theme } = useTheme();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const { orgs } = useOrgStore();
  const { isOwner, isAdmin } = useUserRole();
  const updateUser = (next: AuthUser) => setUser(next);

  const orgName = useMemo(() => {
    const orgId = user?.organisation_id;
    if (!orgId) return "Not assigned";
    return orgs.find((o) => o.id === orgId)?.name ?? orgId;
  }, [orgs, user?.organisation_id]);

  if (!user) {
    return (
      <Card title="Profile">
        <p style={{ margin: 0, color: theme.colors.textSecondary }}>Loading profile...</p>
      </Card>
    );
  }

  const initials = user.name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? "U";

  return (
    <div style={{ display: "grid", gap: theme.spacing.lg, maxWidth: 960 }}>
      <Card title="Profile">
        <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.md }}>
          <div style={{ display: "flex", gap: theme.spacing.sm, alignItems: "center" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                backgroundColor: theme.colors.brandSoft,
                color: theme.colors.brandGrey,
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
                fontSize: theme.typography.subtitle.fontSize,
              }}
            >
              {initials}
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>{user.name ?? user.email}</p>
              <p style={{ margin: 0, color: theme.colors.textSecondary }}>{user.email}</p>
              <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>
                Organisation: {orgName}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: theme.spacing.sm, flexWrap: "wrap" }}>
            <Badge tone="brand">{user.role ?? "User"}</Badge>
            {user.two_factor_enabled ? <Badge tone="success">2FA enabled</Badge> : <Badge tone="warning">2FA disabled</Badge>}
          </div>
        </div>
      </Card>

      <TwoFactorSection user={user} onUserUpdate={updateUser} />
      <SessionsPanel currentUserEmail={user.email} />

      {isOwner || isAdmin ? (
        <Card title="Security overview" subtitle="Quick links for admins and owners">
          <p style={{ margin: 0, color: theme.colors.textSecondary }}>
            Monitor auth events and 2FA enrolment in backend observability dashboards. Rotate secrets after role changes and ensure recovery
            channels are verified.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
