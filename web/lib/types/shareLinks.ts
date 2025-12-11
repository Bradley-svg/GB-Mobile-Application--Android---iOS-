export type ShareLinkStatus = "active" | "expired" | "revoked";

export type ShareLink = {
  id: string;
  scopeType: "site" | "device" | "org";
  scopeId: string;
  permissions: string;
  expiresAt: string;
  createdAt: string;
  revokedAt?: string | null;
  token: string;
  createdBy?: {
    id?: string;
    email?: string | null;
    name?: string | null;
  };
};
