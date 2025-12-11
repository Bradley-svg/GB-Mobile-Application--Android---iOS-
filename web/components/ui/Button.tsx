"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useTheme } from "@/theme/ThemeProvider";
import clsx from "classnames";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md";

type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  as?: "button" | "a";
  href?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const px = (value: number) => `${value}px`;

export function Button({
  children,
  variant = "primary",
  size = "md",
  iconLeft,
  iconRight,
  as = "button",
  href,
  disabled,
  className,
  ...rest
}: ButtonProps) {
  const { theme } = useTheme();

  const paddings = size === "sm" ? `${theme.spacing.xs}px ${theme.spacing.md}px` : `${theme.spacing.sm}px ${theme.spacing.lg}px`;
  const gap = size === "sm" ? theme.spacing.xs : theme.spacing.sm;
  const borderRadius = size === "sm" ? theme.radius.md : theme.radius.lg;

  const palette = {
    primary: {
      background: theme.colors.primary,
      border: theme.colors.primaryMuted,
      text: theme.colors.textInverse,
    },
    secondary: {
      background: theme.colors.surface,
      border: theme.colors.borderStrong,
      text: theme.colors.textPrimary,
    },
    ghost: {
      background: "transparent",
      border: theme.colors.borderSubtle,
      text: theme.colors.textPrimary,
    },
  }[variant];

  const opacity = disabled ? 0.6 : 1;
  const cursor = disabled ? "not-allowed" : "pointer";

  const baseStyles = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap,
    padding: paddings,
    borderRadius,
    background: palette.background,
    color: palette.text,
    border: `1px solid ${palette.border}`,
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.typography.subtitle.fontWeight,
    cursor,
    opacity,
    transition: "transform 120ms ease, box-shadow 120ms ease",
    boxShadow: variant === "primary" ? `0 6px 18px ${theme.colors.shadow}` : "none",
    textDecoration: "none",
  } as const;

  if (as === "a") {
    return (
      <a className={clsx(className)} href={href} style={baseStyles}>
        {iconLeft && <span style={{ display: "flex", alignItems: "center" }}>{iconLeft}</span>}
        <span style={{ lineHeight: px(theme.typography.body.fontSize + 4) }}>{children}</span>
        {iconRight && <span style={{ display: "flex", alignItems: "center" }}>{iconRight}</span>}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={clsx(className)}
      disabled={disabled}
      style={baseStyles}
      {...rest}
    >
      {iconLeft && <span style={{ display: "flex", alignItems: "center" }}>{iconLeft}</span>}
      <span style={{ lineHeight: px(theme.typography.body.fontSize + 4) }}>{children}</span>
      {iconRight && <span style={{ display: "flex", alignItems: "center" }}>{iconRight}</span>}
    </button>
  );
}
