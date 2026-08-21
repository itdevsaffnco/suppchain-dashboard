import { SignJWT, jwtVerify } from "jose";
import { Role, Session, SessionUser } from "./types";

const SESSION_COOKIE = "scm_session";
const SESSION_TTL = "8h";

/** HS256 keys shorter than this are too weak to sign session cookies with. */
const MIN_SECRET_LENGTH = 32;

/**
 * There is deliberately no fallback secret: a guessable key would let anyone
 * forge an Admin session cookie (and the Laravel token it carries). A missing
 * or weak SESSION_SECRET is a deployment error, so we fail loudly instead.
 */
function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `SESSION_SECRET must be set to at least ${MIN_SECRET_LENGTH} characters`
    );
  }

  return new TextEncoder().encode(secret);
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
  // Resolved outside the try so a misconfigured secret surfaces as a real
  // error rather than being swallowed into a silent "not signed in".
  const secret = getSecret();

  try {
    const { payload } = await jwtVerify(token, secret);
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
