import { z } from "zod";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import {
  getUserByUsername,
  getUserByPhone,
  createUser,
  getUserById,
  getAgentByReferralCode,
  getUserTokenVersion,
} from "./db";
import { randomUUID } from "crypto";
import { ENV } from "./_core/env";

const getJwtSecret = (): Uint8Array => {
  const raw = ENV.cookieSecret;
  if (!raw) {
    if (ENV.isProduction) {
      throw new Error("JWT_SECRET is required in production. Set JWT_SECRET in environment.");
    }
    if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
      console.warn("[Auth] JWT_SECRET is not set. Using default dev secret. Set JWT_SECRET in production.");
    }
    return new TextEncoder().encode("change-me-set-JWT_SECRET");
  }
  return new TextEncoder().encode(raw);
};

const JWT_SECRET = getJwtSecret();
const JWT_EXPIRATION = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT token with jti (replay/id) and tokenVersion (invalidated after role/permission change).
 */
export async function generateToken(userId: number, username: string) {
  const tokenVersion = await getUserTokenVersion(userId);
  const jti = randomUUID();
  const token = await new SignJWT({
    userId,
    username,
    jti,
    tokenVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + JWT_EXPIRATION)
    .sign(JWT_SECRET);

  return token;
}

/**
 * Verify and decode JWT token. Returns null if expired, invalid, or tokenVersion no longer matches (e.g. after role change).
 */
export async function verifyToken(token: string): Promise<{ userId: number; username: string } | null> {
  try {
    const verified = await jwtVerify(token, JWT_SECRET);
    const payload = verified.payload as { userId: number; username: string; tokenVersion?: number };
    const currentVersion = await getUserTokenVersion(payload.userId);
    if (Number(payload.tokenVersion ?? 0) !== Number(currentVersion)) {
      return null;
    }
    return { userId: payload.userId, username: payload.username };
  } catch {
    return null;
  }
}

/**
 * Register a new user
 */
export async function registerUser(data: {
  username: string;
  phone: string;
  password: string;
  name: string;
  referralCode?: string;
}) {
  // Validation
  if (!data.username || data.username.length < 3) {
    throw new Error("Username must be at least 3 characters");
  }
  if (data.username.length > 64) {
    throw new Error("Username must be at most 64 characters");
  }

  const phoneDigits = data.phone.replace(/\D/g, "");
  if (!phoneDigits || phoneDigits.length < 9) {
    throw new Error("Invalid phone number");
  }
  if (data.phone.length > 20) {
    throw new Error("Phone number too long");
  }

  if (!data.password || data.password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  if (!data.name || !data.name.trim()) {
    throw new Error("Full name is required");
  }
  if (data.name.length > 200) {
    throw new Error("Full name must be at most 200 characters");
  }

  // Check if user already exists
  const existingUser = await getUserByUsername(data.username);
  if (existingUser) {
    throw new Error("שם המשתמש כבר תפוס");
  }

  const existingPhone = await getUserByPhone(data.phone);
  if (existingPhone) {
    throw new Error("מספר הטלפון כבר רשום במערכת");
  }

  let agentId: number | undefined;
  if (data.referralCode?.trim()) {
    const agent = await getAgentByReferralCode(data.referralCode.trim());
    if (agent) agentId = agent.id;
  }

  // Hash password
  const passwordHash = await hashPassword(data.password);

  // Create user
  await createUser({
    username: data.username,
    phone: data.phone.trim(),
    passwordHash,
    name: data.name.trim(),
    agentId,
  });

  // Get the created user
  const user = await getUserByUsername(data.username);
  if (!user) {
    throw new Error("Failed to create user");
  }

  // Generate token
  const token = await generateToken(user.id, user.username!);

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      points: user.points ?? 0,
    },
    token,
  };
}

/**
 * Login user
 */
export async function loginUser(data: {
  username: string;
  password: string;
}) {

  // Validation
  if (!data.username || !data.password) {
    throw new Error("Username and password are required");
  }


  // Get user
  const user = await getUserByUsername(data.username);
  if (!user || !user.passwordHash) {
    throw new Error("Invalid username or password");
  }

  if ((user as { isBlocked?: boolean }).isBlocked) {
    throw new Error("חשבון זה חסום. פנה למנהל.");
  }

  // Verify password
  const isPasswordValid = await verifyPassword(data.password, user.passwordHash);
  if (!isPasswordValid) {
    throw new Error("Invalid username or password");
  }

  // Generate token
  const token = await generateToken(user.id, user.username!);

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      points: user.points ?? 0,
    },
    token,
  };
}

/**
 * Get user from token
 */
export async function getUserFromToken(token: string) {
  const payload = await verifyToken(token);
  if (!payload) {
    return null;
  }

  const user = await getUserById(payload.userId);
  return user;
}
