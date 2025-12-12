"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { useTheme } from "@/theme/ThemeProvider";

type NavItem = {
  label: string;
  href: string;
  active?: boolean;
  icon?: ReactNode;
};

type AppShellProps = {
  navItems?: NavItem[];
  topLeftSlot?: ReactNode;
  topRightSlot?: ReactNode;
  pageTitle?: string;
  pageSubtitle?: string;
  children: ReactNode;
  hideChrome?: boolean;
};

export function AppShell({
  navItems = [],
  topLeftSlot,
  topRightSlot,
  pageTitle = "Dashboard",
  pageSubtitle,
  children,
  hideChrome = false,
}: AppShellProps) {
  const { theme } = useTheme();
  const fullWindowHref =
    typeof window !== "undefined"
      ? (() => {
          const url = new URL(window.location.href);
          url.searchParams.delete("embed");
          const path = `${url.pathname}${url.search}${url.hash}`;
          return `${window.location.origin}${path}`;
        })()
      : "https://app.greenbro.co.za/app";

  if (hideChrome) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: `linear-gradient(180deg, ${theme.colors.backgroundAlt} 0%, ${theme.colors.background} 280px)`,
          color: theme.colors.textPrimary,
          padding: theme.spacing.md,
          display: "flex",
          flexDirection: "column",
          gap: theme.spacing.md,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: theme.spacing.md,
            backgroundColor: theme.colors.surface,
            border: `1px solid ${theme.colors.borderSubtle}`,
            borderRadius: theme.radius.lg,
            padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
            position: "sticky",
            top: 0,
            zIndex: 5,
            boxShadow: `0 8px 20px ${theme.colors.shadow}`,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: theme.typography.caption.fontSize, color: theme.colors.textSecondary }}>
              Greenbro Dashboard
            </span>
            <strong style={{ fontWeight: theme.typography.subtitle.fontWeight, fontSize: theme.typography.body.fontSize }}>
              Embedded view
            </strong>
          </div>
          <a
            href={fullWindowHref}
            target="_blank"
            rel="noreferrer noopener"
            style={{
              color: theme.colors.primary,
              fontWeight: 600,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Open in full window
          </a>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.md }}>
          {children}
        </div>
      </main>
    );
  }

  return (
    <div className="gb-shell" style={{ color: theme.colors.textPrimary }}>
      <aside
        className="gb-shell__sidebar"
        style={{
          backgroundColor: theme.colors.surface,
          borderRight: `1px solid ${theme.colors.borderSubtle}`,
          boxShadow: `8px 0 28px ${theme.colors.shadow}`,
        }}
      >
        <div className="gb-shell__brand" style={{ gap: theme.spacing.sm }}>
          <div
            className="gb-shell__logo"
            style={{
              background: `linear-gradient(135deg, ${theme.gradients.brandPrimary.start}, ${theme.gradients.brandPrimary.end})`,
              borderRadius: theme.radius.md,
              boxShadow: `0 12px 28px ${theme.colors.shadow}`,
            }}
          >
            <span style={{ color: theme.colors.textInverse, fontWeight: 700, fontSize: 16 }}>GB</span>
          </div>
          <div className="gb-shell__brand-text">
            <span className="gb-shell__brand-name" style={{ color: theme.colors.brandGreen }}>
              Greenbro Monitoring
            </span>
            <span className="gb-shell__brand-sub" style={{ color: theme.colors.textSecondary }}>
              Smart fleet controls
            </span>
          </div>
        </div>
        <nav className="gb-shell__nav" style={{ gap: theme.spacing.xs }}>
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="gb-shell__nav-link"
              style={{
                gap: theme.spacing.sm,
                padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
                borderRadius: theme.radius.md,
                border: `1px solid ${item.active ? theme.colors.borderStrong : theme.colors.borderSubtle}`,
                backgroundColor: item.active ? theme.colors.brandSoft : theme.colors.surfaceAlt,
                color: theme.colors.textPrimary,
                boxShadow: item.active ? `0 10px 24px ${theme.colors.shadow}` : "none",
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      <section className="gb-shell__body">
        <header
          className="gb-shell__topbar"
          style={{
            backgroundColor: theme.colors.surface,
            borderBottom: `1px solid ${theme.colors.borderSubtle}`,
            boxShadow: `0 10px 24px ${theme.colors.shadow}`,
          }}
        >
          <div className="gb-shell__title">
            <span className="gb-shell__eyebrow" style={{ color: theme.colors.brandGreen }}>
              Greenbro Monitoring
            </span>
            <div className="gb-shell__title-row">
              <h1
                style={{
                  margin: 0,
                  fontSize: theme.typography.title2.fontSize,
                  fontWeight: theme.typography.title2.fontWeight,
                  letterSpacing: 0.2,
                }}
              >
                {pageTitle}
              </h1>
              {pageSubtitle ? (
                <span
                  style={{
                    color: theme.colors.textSecondary,
                    fontSize: theme.typography.caption.fontSize,
                  }}
                >
                  {pageSubtitle}
                </span>
              ) : null}
            </div>
          </div>
          <div className="gb-shell__actions" style={{ gap: theme.spacing.md }}>
            {topLeftSlot}
            {topRightSlot}
          </div>
        </header>
        <main
          className="gb-shell__content"
          style={{
            background: `linear-gradient(180deg, ${theme.colors.backgroundAlt} 0%, ${theme.colors.background} 320px)`,
          }}
        >
          <div className="gb-shell__content-inner" style={{ gap: theme.spacing.lg }}>
            {children}
          </div>
        </main>
      </section>

      <style>{`
        .gb-shell {
          display: grid;
          grid-template-columns: 260px 1fr;
          min-height: 100vh;
          background: ${theme.colors.backgroundAlt};
        }

        .gb-shell__sidebar {
          padding: ${theme.spacing.lg}px;
          display: flex;
          flex-direction: column;
          gap: ${theme.spacing.lg}px;
          position: sticky;
          top: 0;
          align-self: flex-start;
          height: 100vh;
        }

        .gb-shell__brand {
          display: flex;
          align-items: center;
        }

        .gb-shell__logo {
          width: 44px;
          height: 44px;
          display: grid;
          place-items: center;
        }

        .gb-shell__brand-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .gb-shell__brand-name {
          font-weight: 700;
          font-size: ${theme.typography.body.fontSize + 2}px;
        }

        .gb-shell__brand-sub {
          font-size: ${theme.typography.caption.fontSize}px;
          letter-spacing: 0.4px;
        }

        .gb-shell__nav {
          display: flex;
          flex-direction: column;
        }

        .gb-shell__nav-link {
          display: inline-flex;
          align-items: center;
          text-decoration: none;
          font-weight: 600;
          transition: transform 120ms ease, box-shadow 120ms ease, background-color 120ms ease;
        }

        .gb-shell__nav-link:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 24px ${theme.colors.shadow};
          background: ${theme.gradients.brandSoft.start};
        }

        .gb-shell__body {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }

        .gb-shell__topbar {
          position: sticky;
          top: 0;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: ${theme.spacing.md}px ${theme.spacing.xl}px;
          gap: ${theme.spacing.md}px;
        }

        .gb-shell__actions {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
        }

        .gb-shell__title {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .gb-shell__eyebrow {
          font-size: ${theme.typography.caption.fontSize}px;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .gb-shell__title-row {
          display: flex;
          align-items: center;
          gap: ${theme.spacing.sm}px;
        }

        .gb-shell__content {
          flex: 1;
          padding: ${theme.spacing.xl}px;
        }

        .gb-shell__content-inner {
          max-width: 1400px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
        }

        @media (max-width: 1200px) {
          .gb-shell {
            grid-template-columns: 240px 1fr;
          }
        }

        @media (max-width: 960px) {
          .gb-shell {
            grid-template-columns: 1fr;
          }
          .gb-shell__sidebar {
            position: relative;
            height: auto;
            flex-direction: row;
            align-items: center;
            gap: ${theme.spacing.md}px;
          }
          .gb-shell__nav {
            flex-direction: row;
            flex-wrap: wrap;
            row-gap: ${theme.spacing.sm}px;
          }
        }

        @media (max-width: 768px) {
          .gb-shell__sidebar {
            padding: ${theme.spacing.md}px ${theme.spacing.lg}px;
          }
          .gb-shell__nav {
            overflow-x: auto;
          }
          .gb-shell__topbar {
            position: sticky;
            top: 0;
            padding: ${theme.spacing.md}px ${theme.spacing.lg}px;
          }
          .gb-shell__content {
            padding: ${theme.spacing.lg}px;
          }
          .gb-shell__content-inner {
            gap: ${theme.spacing.md}px;
          }
        }
      `}</style>
    </div>
  );
}
