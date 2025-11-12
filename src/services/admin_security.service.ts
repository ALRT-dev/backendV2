import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";

// Enhanced security configuration
const SALT_ROUNDS = 14; // Higher than normal for admin accounts
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

export interface RateLimitStore {
  [key: string]: {
    attempts: number;
    lastAttempt: Date;
    lockedUntil?: Date;
  };
}

// In-memory rate limiting (in production, use Redis)
const rateLimitStore: RateLimitStore = {};

export const hashAdminPassword = async (password: string): Promise<string> => {
  try {
    return await bcrypt.hash(password, SALT_ROUNDS);
  } catch (error) {
    throw new Error("Password hashing failed");
  }
};

export const compareAdminPassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  try {
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    throw new Error("Password comparison failed");
  }
};

export const checkRateLimit = (identifier: string): boolean => {
  const now = new Date();
  const attempts = rateLimitStore[identifier];

  if (!attempts) {
    rateLimitStore[identifier] = {
      attempts: 1,
      lastAttempt: now,
    };
    return true;
  }

  // Check if account is locked
  if (attempts.lockedUntil && attempts.lockedUntil > now) {
    return false;
  }

  // Reset if lock period has expired
  if (attempts.lockedUntil && attempts.lockedUntil <= now) {
    rateLimitStore[identifier] = {
      attempts: 1,
      lastAttempt: now,
    };
    return true;
  }

  // Increment attempts
  attempts.attempts += 1;
  attempts.lastAttempt = now;

  // Lock if max attempts exceeded
  if (attempts.attempts >= MAX_FAILED_ATTEMPTS) {
    attempts.lockedUntil = new Date(
      now.getTime() + LOCKOUT_DURATION_MINUTES * 60 * 1000
    );
    return false;
  }

  return true;
};

export const resetRateLimit = (identifier: string): void => {
  delete rateLimitStore[identifier];
};

export const getRemainingLockoutTime = (identifier: string): number => {
  const attempts = rateLimitStore[identifier];
  if (!attempts || !attempts.lockedUntil) {
    return 0;
  }

  const now = new Date();
  const remaining = attempts.lockedUntil.getTime() - now.getTime();
  return Math.max(0, Math.ceil(remaining / 1000)); // Return seconds
};

export const generateSessionId = (): string => {
  return uuidv4();
};

export const validatePasswordStrength = (password: string): boolean => {
  // Admin password requirements:
  // - At least 12 characters
  // - At least one uppercase letter
  // - At least one lowercase letter
  // - At least one number
  // - At least one special character
  const minLength = 12;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  return (
    password.length >= minLength &&
    hasUpperCase &&
    hasLowerCase &&
    hasNumbers &&
    hasSpecialChar
  );
};
