#!/usr/bin/env node

const sampleBranch = "web-preview";

const lines = [
  "Vercel Preview URL workflow (web dashboard):",
  `- Push a branch (e.g. ${sampleBranch}) or open a PR to trigger the Web Deploy workflow.`,
  "- Preview URL is printed in the workflow summary (Deploy to Vercel step) and in Vercel > Deployments.",
  "- URLs:",
  "  - Full app: https://<preview>.vercel.app/app",
  "  - Embed: https://<preview>.vercel.app/embed",
  "- Preview env vars (set in Vercel or CI):",
  "  NEXT_PUBLIC_API_URL=https://staging.api.greenbro.co.za",
  "  NEXT_PUBLIC_EMBEDDED=true",
  "  FRAME_ANCESTORS=https://www.greenbro.co.za,https://greenbro.co.za",
  `- Branch workflow: git checkout -b ${sampleBranch} && git push origin ${sampleBranch}`,
  "- Troubleshoot:",
  "  401/403: check staging CORS / WEB_ALLOWED_ORIGINS / JWT",
  "  Empty data: ensure staging demo seed/migrations are applied",
  "  Embed blocked: align FRAME_ANCESTORS + backend WEB_ALLOWED_ORIGINS with the WordPress host",
];

console.log(lines.join("\n"));
