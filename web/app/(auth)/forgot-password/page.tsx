"use client";

import axios from "axios";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card } from "@/components/ui";
import { requestPasswordReset } from "@/lib/api/authApi";
import { useEmbed } from "@/lib/useEmbed";
import { useTheme } from "@/theme/ThemeProvider";

const schema = z.object({
  email: z.string().email(),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const { appendEmbedParam } = useEmbed();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      setError(null);
      await requestPasswordReset(values.email.trim());
      router.replace(
        appendEmbedParam(
          `/login?success=${encodeURIComponent("Password reset link sent. Check your email to continue.")}`,
        ),
      );
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const message = (err.response?.data as { message?: string } | undefined)?.message;
        setError(message || "Unable to request password reset. Please try again.");
        return;
      }
      setError("Unable to request password reset. Please try again.");
    }
  };

  return (
    <Card>
      <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.md }}>
        <header style={{ display: "flex", flexDirection: "column", gap: theme.spacing.xs }}>
          <h1
            style={{
              margin: 0,
              fontSize: theme.typography.title2.fontSize,
              fontWeight: theme.typography.title2.fontWeight,
            }}
          >
            Forgot password
          </h1>
          <p style={{ margin: 0, color: theme.colors.textSecondary }}>
            We&apos;ll email you a link to reset your password.
          </p>
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

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <a
              href={appendEmbedParam("/login")}
              style={{ color: theme.colors.primary, fontSize: theme.typography.caption.fontSize }}
            >
              Back to login
            </a>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Send reset link"}
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
}
