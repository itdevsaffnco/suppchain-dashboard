import { SignJWT, jwtVerify } from "jose";
import { createHash } from "node:crypto";
import { Role, SessionUser } from "./types";

const SESSION_COOKIE = "scm_session";
const SESSION_TTL = "8h";

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (secret) return new TextEncoder().encode(secret);
  // Dev-only fallback so the app runs without configuration. Set SESSION_SECRET
  // to a strong random value in production.
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is not configured");
  }
  return new TextEncoder().encode("dev-insecure-secret-change-me");
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.username)
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub || !payload.role) return null;
    return { username: payload.sub as string, role: payload.role as Role };
  } catch {
    return null;
  }
}

export { SESSION_COOKIE };
