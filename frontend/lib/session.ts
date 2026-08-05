// Server-side session cookie helpers.
import { cookies } from "next/headers";
import { SESSION_COOKIE, createSessionToken, verifySessionToken } from "./auth";
import { Session, SessionUser } from "./types";

const MAX_AGE = 60 * 60 * 8; // 8h, matches the JWT TTL

export async function setSession(user: SessionUser, apiToken: string): Promise<void> {
  const token = await createSessionToken(user, apiToken);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
