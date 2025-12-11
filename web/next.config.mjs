/** @type {import("next").NextConfig} */
const nextConfig = (() => {
  const isProdBuild = process.env.NODE_ENV === "production";

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

  if (isProdBuild && (!resolvedApiUrl || resolvedEmbedded === undefined)) {
    throw new Error(
      "NEXT_PUBLIC_API_URL and NEXT_PUBLIC_EMBEDDED must be set for production/staging builds.",
    );
  }

  return {
    reactStrictMode: true,
    swcMinify: true,
    poweredByHeader: false,
    experimental: {
      externalDir: true,
    },
    async headers() {
      return [
        {
          source: "/:path*",
          headers: [
            {
              key: "Content-Security-Policy",
              value: `frame-ancestors ${frameAncestors.join(" ")};`,
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
