/** @type {import("next").NextConfig} */
const nextConfig = (() => {
  const isProdBuild = process.env.NODE_ENV === "production";

  const resolvedApiUrl =
    process.env.NEXT_PUBLIC_API_URL || (!isProdBuild ? "http://localhost:4000" : undefined);
  const resolvedEmbedded =
    process.env.NEXT_PUBLIC_EMBEDDED || (!isProdBuild ? "false" : undefined);

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
    env: {
      NEXT_PUBLIC_API_URL: resolvedApiUrl ?? "http://localhost:4000",
      NEXT_PUBLIC_EMBEDDED: `${resolvedEmbedded ?? "false"}`,
    },
  };
})();

export default nextConfig;
