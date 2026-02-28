import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(user?: AuthenticatedUser): { ctx: TrpcContext; setCookie: (name: string, value: string, options: any) => void; cookies: Map<string, string> } {
  const cookies = new Map<string, string>();
  const setCookieFn = (name: string, value: string, options: any) => {
    cookies.set(name, value);
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: setCookieFn,
      clearCookie: () => {},
    } as any,
  };

  return { ctx, setCookie: setCookieFn, cookies };
}

describe("auth", () => {
  const testUsername = `testuser_${Date.now()}`;
  const testEmail = `test_${Date.now()}@example.com`;
  const testPassword = "TestPassword123";

  afterAll(async () => {
    // Cleanup test user
    const db = await getDb();
    if (db) {
      await db.delete(users).where(eq(users.username, testUsername));
    }
  });

  describe("register", () => {
    it("should register a new user successfully", async () => {
      const { ctx } = createContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.register({
        username: testUsername,
        email: testEmail,
        password: testPassword,
        name: "Test User",
      });

      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.username).toBe(testUsername);
      expect(result.user.email).toBe(testEmail);
      expect(result.token).toBeDefined();
    });

    it("should reject duplicate username", async () => {
      const { ctx } = createContext();
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.auth.register({
          username: testUsername,
          email: `another_${Date.now()}@example.com`,
          password: testPassword,
        });
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should reject invalid email", async () => {
      const { ctx } = createContext();
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.auth.register({
          username: `newuser_${Date.now()}`,
          email: "invalid-email",
          password: testPassword,
        });
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should reject short password", async () => {
      const { ctx } = createContext();
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.auth.register({
          username: `newuser_${Date.now()}`,
          email: `test_${Date.now()}@example.com`,
          password: "short",
        });
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("login", () => {
    it("should login successfully with correct credentials", async () => {
      const { ctx } = createContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.login({
        username: testUsername,
        password: testPassword,
      });

      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.username).toBe(testUsername);
      expect(result.token).toBeDefined();
    });

    it("should reject login with wrong password", async () => {
      const { ctx } = createContext();
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.auth.login({
          username: testUsername,
          password: "WrongPassword123",
        });
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should reject login with non-existent user", async () => {
      const { ctx } = createContext();
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.auth.login({
          username: "nonexistent_user",
          password: testPassword,
        });
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("logout", () => {
    it("should clear session cookie", async () => {
      const user: AuthenticatedUser = {
        id: 1,
        openId: "test-user",
        email: testEmail,
        name: "Test User",
        username: testUsername,
        loginMethod: "local",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      };

      const { ctx } = createContext(user);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.logout();

      expect(result).toEqual({ success: true });
    });
  });
});
