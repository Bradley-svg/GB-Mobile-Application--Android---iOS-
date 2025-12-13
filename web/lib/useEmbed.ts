"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { EMBED_ALLOWED } from "@/config/env";

export function useEmbed() {
  const searchParams = useSearchParams();
  const isFramed = useMemo(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.self !== window.top;
    } catch {
      return false;
    }
  }, []);
  const embedParam = searchParams.get("embed") === "true";

  const embedActive = EMBED_ALLOWED && (embedParam || isFramed);

  const appendEmbedParam = useCallback(
    (href: string) => {
      if (!embedActive) return href;
      if (href.includes("embed=true")) return href;

      const [withoutHash, hash = ""] = href.split("#");
      const separator = withoutHash.includes("?") ? "&" : "?";
      const hashSuffix = hash ? `#${hash}` : "";
      return `${withoutHash}${separator}embed=true${hashSuffix}`;
    },
    [embedActive],
  );

  const embedQueryString = useMemo(() => (embedActive ? "?embed=true" : ""), [embedActive]);

  return {
    embedActive,
    embedFromQuery: embedParam,
    embedQueryString,
    appendEmbedParam,
  };
}
