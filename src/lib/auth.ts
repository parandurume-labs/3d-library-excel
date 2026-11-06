import { getToken, type JWT } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import type { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import { LibraryError, type Actor, type LibraryState } from "./domain";
import { DEMO_ADMIN_ID, DEMO_MEMBER_ID } from "./demo-data";

export const dataMode = process.env.DATA_MODE === "graph" ? "graph" as const : "demo" as const;

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID ?? "",
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET ?? "",
      tenantId: process.env.AZURE_AD_TENANT_ID ?? "common",
      authorization: {
        params: {
          scope: "openid profile email offline_access Files.ReadWrite.All User.Read",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.graphAccessToken = account.access_token;
        token.graphExpiresAt = account.expires_at;
        token.entraId = token.sub;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.entraId ?? token.sub ?? "");
      }
      return session;
    },
  },
};

type GraphToken = JWT & { graphAccessToken?: string; graphExpiresAt?: number; entraId?: string };

export async function getGraphToken(request: NextRequest): Promise<GraphToken> {
  if (dataMode !== "graph") throw new LibraryError("Graph token requested in demo mode.", "INVALID_STATE", 400);
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET }) as GraphToken | null;
  if (!token?.graphAccessToken) throw new LibraryError("Sign in with Microsoft to access the workbook.", "AUTH_REQUIRED", 401);
  if (token.graphExpiresAt && token.graphExpiresAt * 1000 <= Date.now()) {
    throw new LibraryError("Microsoft access token expired. Sign out and sign in again.", "AUTH_EXPIRED", 401);
  }
  return token;
}

export async function resolveActor(request: NextRequest, state: LibraryState, token?: GraphToken): Promise<Actor> {
  if (dataMode === "demo") {
    const demoIdentity = request.headers.get("x-demo-user") ?? "member";
    const id = demoIdentity === "admin" ? DEMO_ADMIN_ID : DEMO_MEMBER_ID;
    const user = state.users.find((candidate) => candidate.id === id);
    if (!user) throw new LibraryError("Demo identity is missing from the repository.", "SCHEMA_ERROR", 422);
    return { id, role: user.role };
  }
  const authId = String(token?.entraId ?? token?.sub ?? "");
  const email = String(token?.email ?? "").toLowerCase();
  const user = state.users.find((candidate) =>
    candidate.authId.toLowerCase() === authId.toLowerCase()
    || candidate.email.toLowerCase() === email,
  );
  if (!user) {
    throw new LibraryError("Your Microsoft identity is not registered in Users. Ask an administrator to add it.", "FORBIDDEN", 403);
  }
  return { id: user.id, role: user.role };
}
