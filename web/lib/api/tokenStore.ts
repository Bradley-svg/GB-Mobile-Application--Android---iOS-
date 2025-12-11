import type { AuthTokens } from "@/lib/types/auth";

type TokenSnapshot = {
  accessToken?: string;
  refreshToken?: string;
};

type TokenGetter = () => TokenSnapshot;
type TokenSetter = (tokens: AuthTokens | null) => void;

let getter: TokenGetter = () => ({});
let setter: TokenSetter | null = null;

export const registerTokenGetter = (fn: TokenGetter) => {
  getter = fn;
};

export const getTokens = (): TokenSnapshot => getter();

export const registerTokenSetter = (fn: TokenSetter) => {
  setter = fn;
};

export const setTokensFromRefresh = (tokens: AuthTokens | null) => {
  setter?.(tokens);
};
