export type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
  organisation_id?: string | null;
  role?: string | null;
  two_factor_enabled?: boolean;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthResponse = Partial<AuthTokens> & {
  user?: AuthUser;
  requires2fa?: boolean;
  challengeToken?: string;
  twoFactorSetupRequired?: boolean;
};
