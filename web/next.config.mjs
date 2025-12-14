import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tokensPath = path.resolve(__dirname, "../packages/ui-tokens/src");

/** @type {import("next").NextConfig} */
const nextConfig = (() => {
  const isProdBuild = process.env.NODE_ENV === "production";
  const isDev = !isProdBuild;

  const resolvedApiUrl =
    process.env.NEXT_PUBLIC_API_URL || (!isProdBuild ? "http://localhost:4000" : undefined);
  const resolvedEmbedded =
    process.env.NEXT_PUBLIC_EMBEDDED || (!isProdBuild ? "false" : undefined);
  const embedEnabled = `${resolvedEmbedded ?? "false"}` === "true";
  const frameAncestorsFromEnv =
    process.env.FRAME_ANCESTORS || process.env.NEXT_FRAME_ANCESTORS || "";
  const baseFrameAncestors = (() => {
    const parsed = frameAncestorsFromEnv
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (parsed.length > 0) return parsed;
    const defaults = ["'self'", "https://www.greenbro.co.za", "https://greenbro.co.za"];
    if (!isProdBuild) {
      defaults.push("http://localhost:3000", "http://127.0.0.1:3000");
    }
    return defaults;
  })();
  const frameAncestors = embedEnabled ? Array.from(new Set(baseFrameAncestors)) : ["'self'"];
  const primaryFrameAncestor =
    frameAncestors.find((entry) => entry !== "'self'") || "https://www.greenbro.co.za";
  const xFrameValue = embedEnabled ? `ALLOW-FROM ${primaryFrameAncestor}` : "SAMEORIGIN";
  const normalizedApiUrl = resolvedApiUrl ? resolvedApiUrl.replace(/\/$/, "") : undefined;
  const connectSources = new Set(["'self'"]);
  if (normalizedApiUrl) connectSources.add(normalizedApiUrl);
  connectSources.add("https://fonts.googleapis.com");
  connectSources.add("https://fonts.gstatic.com");
  if (!isProdBuild) {
    connectSources.add("http://localhost:3000");
    connectSources.add("http://127.0.0.1:3000");
    connectSources.add("ws://localhost:3000");
    connectSources.add("ws://127.0.0.1:3000");
  }
  const scriptSources = new Set(["'self'"]);
  if (!isProdBuild) {
    scriptSources.add("'unsafe-eval'");
  }
  if (isDev) {
    scriptSources.add("'unsafe-inline'");
  }
  const styleSources = new Set(["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"]);
  const fontSources = new Set(["'self'", "data:", "https://fonts.gstatic.com"]);
  const imgSources = new Set(["'self'", "data:", "blob:"]);
  const cspDirectives = [
    ["default-src", ["'self'"]],
    ["script-src", Array.from(scriptSources)],
    ["style-src", Array.from(styleSources)],
    ["img-src", Array.from(imgSources)],
    ["font-src", Array.from(fontSources)],
    ["connect-src", Array.from(connectSources)],
    ["frame-ancestors", frameAncestors],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
  ];
  const contentSecurityPolicy = cspDirectives
    .map(([key, values]) => `${key} ${(values ?? []).join(" ")}`)
    .join("; ");

  if (isProdBuild && (!resolvedApiUrl || resolvedEmbedded === undefined)) {
    throw new Error(
      "NEXT_PUBLIC_API_URL and NEXT_PUBLIC_EMBEDDED must be set for production/staging builds.",
    );
  }

  return {
    reactStrictMode: true,
    poweredByHeader: false,
    experimental: {
      externalDir: true,
    },
    webpack: (config) => {
      config.resolve.alias["@greenbro/ui-tokens"] = tokensPath;
      return config;
    },
    async headers() {
      return [
        {
          source: "/:path*",
          headers: [
            {
              key: "Content-Security-Policy",
              value: contentSecurityPolicy,
            },
            {
              key: "X-Frame-Options",
              value: xFrameValue,
            },
          ],
        },
      ];
    },
    env: {
      NEXT_PUBLIC_API_URL: resolvedApiUrl ?? "http://localhost:4000",
      NEXT_PUBLIC_EMBEDDED: `${resolvedEmbedded ?? "false"}`,
    },
  };
})();

export default nextConfig;
