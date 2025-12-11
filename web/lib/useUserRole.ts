import { useAuthStore } from "@/lib/authStore";

export function useUserRole() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role?.toLowerCase() ?? "";

  const isOwner = role === "owner";
  const isAdmin = role === "admin";
  const isFacilities = role === "facilities";
  const isContractor = role === "contractor";

  return {
    role,
    isOwner,
    isAdmin,
    isFacilities,
    isContractor,
  };
}
