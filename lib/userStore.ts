// Server-side in-memory user store (seed/demo mode). Backs login, user
// management, and the forgot/reset-password flow. When the Apps Script
// backend is wired up, these operations forward to the Sheets "Users" tab.
//
// Stored on globalThis so the store survives dev-server HMR reloads. Data
// resets on process restart — acceptable for demo mode, same as seed SKUs.
import { randomBytes } from "node:crypto";
import { sha256 } from "./auth";
import { AppUser, SEED_USERS } from "./dashboard";

export interface StoredUser extends AppUser {
  // Absent for seed users until they set one (demo mode accepts any password);
  // always present for users created via user management.
  passwordHash?: string;
}

interface ResetToken {
  userId: number;
  expiresAt: number; // epoch ms
}

interface UserStore {
  users: StoredUser[];
  resetTokens: Map<string, ResetToken>;
}

const RESET_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getStore(): UserStore {
  const g = globalThis as typeof globalThis & { __scmUserStore?: UserStore };
  if (!g.__scmUserStore) {
    g.__scmUserStore = {
      users: JSON.parse(JSON.stringify(SEED_USERS)) as StoredUser[],
      resetTokens: new Map(),
    };
  }
  return g.__scmUserStore;
}

/** Users without password hashes — safe to send to the client. */
export function listUsers(): AppUser[] {
  return getStore().users.map(({ passwordHash: _ph, ...u }) => u);
}

/** Case-insensitive lookup by username OR email. */
export function findByLogin(identifier: string): StoredUser | undefined {
  const id = identifier.trim().toLowerCase();
  return getStore().users.find(
    (u) => u.username.toLowerCase() === id || u.email.toLowerCase() === id
  );
}

export function findByEmail(email: string): StoredUser | undefined {
  const e = email.trim().toLowerCase();
  return getStore().users.find((u) => u.email.toLowerCase() === e);
}

/**
 * Demo-mode password check: users with a stored hash must match it; seed
 * users without one accept any password (they have no known secret yet).
 */
export function verifyPassword(user: StoredUser, password: string): boolean {
  if (!user.passwordHash) return true;
  return user.passwordHash === sha256(password);
}

export function addUser(input: {
  username: string;
  email: string;
  role: AppUser["role"];
  password: string;
}): AppUser | { error: string } {
  const store = getStore();
  if (findByLogin(input.username) || findByEmail(input.email)) {
    return { error: "user_exists" };
  }
  const user: StoredUser = {
    id: Math.floor(Math.random() * 9000) + 1000,
    username: input.username.trim(),
    email: input.email.trim(),
    role: input.role,
    status: "Active",
    passwordHash: sha256(input.password),
  };
  store.users.push(user);
  const { passwordHash: _ph, ...safe } = user;
  return safe;
}

export function deleteUser(id: number): boolean {
  const store = getStore();
  const before = store.users.length;
  store.users = store.users.filter((u) => u.id !== id);
  return store.users.length < before;
}

export function setPassword(userId: number, password: string): boolean {
  const user = getStore().users.find((u) => u.id === userId);
  if (!user) return false;
  user.passwordHash = sha256(password);
  return true;
}

// --- Password reset tokens --------------------------------------------------

export function createResetToken(userId: number): string {
  const store = getStore();
  const token = randomBytes(32).toString("hex");
  store.resetTokens.set(token, { userId, expiresAt: Date.now() + RESET_TTL_MS });
  return token;
}

/** Returns the user for a live token, or null if unknown/expired. */
export function peekResetToken(token: string): StoredUser | null {
  const store = getStore();
  const entry = store.resetTokens.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.resetTokens.delete(token);
    return null;
  }
  return store.users.find((u) => u.id === entry.userId) ?? null;
}

/** Single-use: validates then invalidates the token. */
export function consumeResetToken(token: string): StoredUser | null {
  const user = peekResetToken(token);
  if (user) getStore().resetTokens.delete(token);
  return user;
}
