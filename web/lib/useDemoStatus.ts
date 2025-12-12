import { useQuery } from "@tanstack/react-query";
import { fetchDemoStatus } from "@/lib/api/demo";
import type { DemoStatus } from "@/lib/types/demo";

type UseDemoStatusOptions = {
  enabled?: boolean;
};

export function useDemoStatus(options: UseDemoStatusOptions = {}) {
  const enabled = options.enabled ?? true;
  return useQuery<DemoStatus>({
    queryKey: ["demo-status"],
    queryFn: fetchDemoStatus,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled,
  });
}
