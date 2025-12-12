"use client";

import axios from "axios";
import { useSearchParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Badge, Button, Card } from "@/components/ui";
import { useAuthStore } from "@/lib/authStore";
import { appendReturnToParam, sanitizeReturnTo, DEFAULT_RETURN_TO } from "@/lib/returnTo";
import { useEmbed } from "@/lib/useEmbed";
import { useTheme } from "@/theme/ThemeProvider";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

const parseLockout = (error: unknown) => {
  if (!axios.isAxiosError(error)) return null;
  if (error.response?.status !== 429) return null;
  const lockedUntilRaw = (error.response.data as { lockedUntil?: string } | undefined)?.lockedUntil;
  const retryAfter = error.response?.headers?.["retry-after"];
  const lockedUntil = lockedUntilRaw ? new Date(lockedUntilRaw) : null;
  const retrySeconds = retryAfter ? Number(retryAfter) : null;
  let minutes: number | null = null;

  if (lockedUntil && !Number.isNaN(lockedUntil.getTime())) {
    minutes = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / (60 * 1000)));
  } else if (Number.isFinite(retrySeconds)) {
    minutes = Math.max(1, Math.ceil((retrySeconds as number) / 60));
  }

  const waitCopy = minutes
    ? ` Please wait ${minutes} minute${minutes === 1 ? "" : "s"} before trying again.`
    : " Please wait before trying again.";
  return `Too many failed attempts.${waitCopy}`;
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const { theme } = useTheme();
  const { appendEmbedParam } = useEmbed();
  const successMessage = searchParams.get("success");
  const expiredReason = searchParams.get("expired");
  const rawReturnTo = searchParams.get("returnTo");
  const returnTo = useMemo(() => sanitizeReturnTo(rawReturnTo, DEFAULT_RETURN_TO), [rawReturnTo]);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      setError(null);
      const result = await login(values.email.trim(), values.password);
      if (result.requires2fa && result.challengeToken) {
        const params = new URLSearchParams({
          challengeToken: result.challengeToken,
          email: values.email.trim(),
        });
        params.set("returnTo", returnTo);
        router.replace(appendEmbedParam(`/login/2fa?${params.toString()}`));
        return;
      }
      router.replace(appendEmbedParam(returnTo || DEFAULT_RETURN_TO));
    } catch (err) {
      const lockout = parseLockout(err);
      if (lockout) {
        setError(lockout);
        return;
      }
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 401) {
          setError("Invalid email or password.");
          return;
        }
        const message = (err.response?.data as { message?: string } | undefined)?.message;
        setError(message || "Login failed. Please try again.");
        return;
      }
      setError("Login failed. Please try again.");
    }
  };

  return (
    <Card>
      <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.md }}>
        <header style={{ display: "flex", flexDirection: "column", gap: theme.spacing.xs }}>
          <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>
            Greenbro
          </p>
          <h1
            style={{
              margin: 0,
              fontSize: theme.typography.title1.fontSize,
              fontWeight: theme.typography.title1.fontWeight,
            }}
          >
            Welcome back
          </h1>
          <p style={{ margin: 0, color: theme.colors.textSecondary }}>Monitor and control your Greenbro fleet.</p>
        </header>

        {successMessage ? (
          <Badge tone="success"> {successMessage}</Badge>
        ) : expiredReason ? (
          <Badge tone="warning">Session expired. Please sign in again.</Badge>
        ) : null}

        {error ? (
          <div
            style={{
              padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
              borderRadius: theme.radius.md,
              border: `1px solid ${theme.colors.error}`,
              backgroundColor: theme.colors.errorSoft,
              color: theme.colors.error,
            }}
          >
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: theme.spacing.sm }}>
          <label style={{ display: "flex", flexDirection: "column", gap: theme.spacing.xs }}>
            <span style={{ fontSize: theme.typography.caption.fontSize, color: theme.colors.textSecondary }}>
              Email
            </span>
            <input
              type="email"
              {...register("email")}
              style={{
                padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
                borderRadius: theme.radius.md,
                border: `1px solid ${theme.colors.borderSubtle}`,
                backgroundColor: theme.colors.backgroundAlt,
              }}
              placeholder="you@example.com"
            />
            {errors.email && (
              <span style={{ color: theme.colors.error, fontSize: theme.typography.caption.fontSize }}>
                {errors.email.message}
              </span>
            )}
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: theme.spacing.xs }}>
            <span style={{ fontSize: theme.typography.caption.fontSize, color: theme.colors.textSecondary }}>
              Password
            </span>
            <input
              type="password"
              {...register("password")}
              style={{
                padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
                borderRadius: theme.radius.md,
                border: `1px solid ${theme.colors.borderSubtle}`,
                backgroundColor: theme.colors.backgroundAlt,
              }}
              placeholder="********"
            />
            {errors.password && (
              <span style={{ color: theme.colors.error, fontSize: theme.typography.caption.fontSize }}>
                {errors.password.message}
              </span>
            )}
          </label>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <a
              href={appendEmbedParam(appendReturnToParam("/forgot-password", returnTo))}
              style={{ color: theme.colors.primary, fontSize: theme.typography.caption.fontSize }}
            >
              Forgot password?
            </a>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? "Logging in..." : "Login"}
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
}
