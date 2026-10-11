import type { JWT } from "next-auth/jwt";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const calendarScope = "openid email profile https://www.googleapis.com/auth/calendar.readonly";

export function googleAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.NEXTAUTH_SECRET);
}

async function refreshAccessToken(token: JWT): Promise<JWT> {
  const refreshToken = token.refreshToken;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret || typeof refreshToken !== "string") {
    return { ...token, error: "RefreshAccessTokenError" };
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const body: unknown = await response.json().catch(() => null);
  if (
    !response.ok ||
    !body ||
    typeof body !== "object" ||
    !("access_token" in body) ||
    typeof body.access_token !== "string" ||
    !("expires_in" in body) ||
    typeof body.expires_in !== "number"
  ) {
    return { ...token, error: "RefreshAccessTokenError" };
  }

  return {
    ...token,
    accessToken: body.access_token,
    expiresAt: Math.floor(Date.now() / 1000) + body.expires_in,
    refreshToken: "refresh_token" in body && typeof body.refresh_token === "string" ? body.refresh_token : refreshToken,
    error: undefined,
  };
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope: calendarScope,
        },
      },
    }),
  ],
  pages: {
    signIn: "/",
    error: "/?calendar=1",
  },
  callbacks: {
    async jwt({ token, account }) {
      if (account?.access_token) {
        const expiresIn = typeof account.expires_in === "number" ? account.expires_in : 3600;
        const expiresAt =
          typeof account.expires_at === "number" ? account.expires_at : Math.floor(Date.now() / 1000) + expiresIn;
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token ?? token.refreshToken,
          expiresAt,
          error: undefined,
        };
      }
      if (typeof token.accessToken === "string" && typeof token.expiresAt !== "number") {
        return { ...token, expiresAt: Math.floor(Date.now() / 1000) + 3600, error: undefined };
      }
      if (typeof token.expiresAt === "number" && Date.now() < token.expiresAt * 1000 - 60_000) {
        return token;
      }
      if (typeof token.refreshToken !== "string") return token;
      const refreshed = await refreshAccessToken(token);
      if (refreshed.error === "RefreshAccessTokenError" && typeof token.accessToken === "string") return token;
      return refreshed;
    },
  },
};
