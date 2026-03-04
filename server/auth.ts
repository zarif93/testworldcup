import { z } from "zod";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import {
  getUserByUsername,
  getUserByPhone,
  createUser,
  getUserById,
  getAgentByReferralCode,
} from "./db";
import { ENV } from "./_core/env";

const getJwtSecret = (): Uint8Array => {
  const raw = ENV.cookieSecret;
  if (!raw) {
    if (ENV.isProduction) {
      console.warn(
        "[auth] WARNING: JWT_SECRET is not set. Using a fallback. Set JWT_SECRET in .env or environment for production security!"
      );
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
 * Generate JWT token
 */
export async function generateToken(userId: number, username: string) {
  const token = await new SignJWT({
    userId,
    username,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + JWT_EXPIRATION)
    .sign(JWT_SECRET);

  return token;
}

/**
 * Verify and decode JWT token
 */
export async function verifyToken(token: string) {
  try {
    const verified = await jwtVerify(token, JWT_SECRET);
    return verified.payload as { userId: number; username: string };
  } catch (error) {
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

  const phoneDigits = data.phone.replace(/\D/g, "");
  if (!phoneDigits || phoneDigits.length < 9) {
    throw new Error("Invalid phone number");
  }

  if (!data.password || data.password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  if (!data.name || !data.name.trim()) {
    throw new Error("Full name is required");
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
