"use client";

import axios from "axios";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Badge, Button, Card } from "@/components/ui";
import { useAuthStore } from "@/lib/authStore";
import { useEmbed } from "@/lib/useEmbed";
import { useTheme } from "@/theme/ThemeProvider";

const schema = z.object({
  code: z.string().min(6, "Enter your 6-digit code"),
});

type FormValues = z.infer<typeof schema>;

export default function TwoFactorPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { theme } = useTheme();
  const completeTwoFactor = useAuthStore((s) => s.completeTwoFactor);
  const { appendEmbedParam } = useEmbed();
  const challengeToken = searchParams.get("challengeToken") || "";
  const email = searchParams.get("email");
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { code: "" },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      setError(null);
      if (!challengeToken) {
        setError("Missing login challenge. Please start again.");
        return;
      }
      await completeTwoFactor(challengeToken, values.code.trim());
      router.replace(appendEmbedParam("/app"));
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 401) {
          setError("Invalid or expired code. Try again.");
          return;
        }
        const message = (err.response?.data as { message?: string } | undefined)?.message;
        setError(message || "Verification failed. Please try again.");
        return;
      }
      setError("Verification failed. Please try again.");
    }
  };

  return (
    <Card>
      <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.md }}>
        <header style={{ display: "flex", flexDirection: "column", gap: theme.spacing.xs }}>
          <Badge tone="brand">Two-factor required</Badge>
          <h1
            style={{
              margin: 0,
              fontSize: theme.typography.title2.fontSize,
              fontWeight: theme.typography.title2.fontWeight,
            }}
          >
            Enter your 2FA code
          </h1>
          {email ? (
            <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize }}>
              Account: {email}
            </p>
          ) : null}
        </header>

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
              Authenticator code
            </span>
            <input
              type="text"
              inputMode="numeric"
              {...register("code")}
              style={{
                padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
                borderRadius: theme.radius.md,
                border: `1px solid ${theme.colors.borderSubtle}`,
                backgroundColor: theme.colors.backgroundAlt,
                letterSpacing: 4,
                textAlign: "center",
              }}
              placeholder="123456"
            />
            {errors.code && (
              <span style={{ color: theme.colors.error, fontSize: theme.typography.caption.fontSize }}>
                {errors.code.message}
              </span>
            )}
          </label>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <a
              href={appendEmbedParam("/login")}
              style={{ color: theme.colors.primary, fontSize: theme.typography.caption.fontSize }}
            >
              Start over
            </a>
            <Button type="submit" variant="primary" disabled={isSubmitting || !challengeToken}>
              {isSubmitting ? "Verifying..." : "Verify and continue"}
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
}
