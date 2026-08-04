import { SignJWT, jwtVerify } from "jose";
import { Role, Session, SessionUser } from "./types";

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

/**
 * The cookie carries the Laravel token so the Next server can call the backend
 * on this user's behalf. The cookie is httpOnly and signed, so the token never
 * reaches client-side JavaScript.
 */
export async function createSessionToken(user: SessionUser, apiToken: string): Promise<string> {
  return new SignJWT({ role: user.role, apiToken })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.username)
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub || !payload.role || !payload.apiToken) return null;
    return {
      username: payload.sub as string,
      role: payload.role as Role,
      apiToken: payload.apiToken as string,
    };
  } catch {
    return null;
  }
}

export { SESSION_COOKIE };
