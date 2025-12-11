"use client";

import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card } from "@/components/ui";
import { resetPassword } from "@/lib/api/authApi";
import { useTheme } from "@/theme/ThemeProvider";

const schema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords must match",
  });

type FormValues = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme } = useTheme();
  const token = searchParams.get("token");
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = async (values: FormValues) => {
    if (!token) {
      setError("Reset token missing or invalid. Please retry from your email link.");
      return;
    }

    try {
      setError(null);
      await resetPassword({ token, newPassword: values.password });
      router.replace(`/login?success=${encodeURIComponent("Password updated. You can now login.")}`);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const message = (err.response?.data as { message?: string } | undefined)?.message;
        setError(message || "Unable to reset password. Please try again.");
        return;
      }
      setError("Unable to reset password. Please try again.");
    }
  };

  if (!token) {
    return (
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.sm }}>
          <h1
            style={{
              margin: 0,
              fontSize: theme.typography.title2.fontSize,
              fontWeight: theme.typography.title2.fontWeight,
            }}
          >
            Reset link invalid
          </h1>
          <p style={{ margin: 0, color: theme.colors.textSecondary }}>
            Your reset link is missing or expired. Please request a new one.
          </p>
          <Button variant="primary" onClick={() => router.replace("/forgot-password")}>
            Request new link
          </Button>
        </div>
      </Card>
    );
  }

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
            Reset password
          </h1>
          <p style={{ margin: 0, color: theme.colors.textSecondary }}>Choose a new password to continue.</p>
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
              New password
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

          <label style={{ display: "flex", flexDirection: "column", gap: theme.spacing.xs }}>
            <span style={{ fontSize: theme.typography.caption.fontSize, color: theme.colors.textSecondary }}>
              Confirm password
            </span>
            <input
              type="password"
              {...register("confirmPassword")}
              style={{
                padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
                borderRadius: theme.radius.md,
                border: `1px solid ${theme.colors.borderSubtle}`,
                backgroundColor: theme.colors.backgroundAlt,
              }}
              placeholder="********"
            />
            {errors.confirmPassword && (
              <span style={{ color: theme.colors.error, fontSize: theme.typography.caption.fontSize }}>
                {errors.confirmPassword.message}
              </span>
            )}
          </label>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <a href="/login" style={{ color: theme.colors.primary, fontSize: theme.typography.caption.fontSize }}>
              Back to login
            </a>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? "Updating..." : "Update password"}
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
}
