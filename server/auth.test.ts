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
  const testPhone = "0500000000";
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
        phone: testPhone,
        password: testPassword,
        name: "Test User",
      });

      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.username).toBe(testUsername);
      expect(result.token).toBeDefined();
    });

    it("should reject duplicate username", async () => {
      const { ctx } = createContext();
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.auth.register({
          username: testUsername,
          phone: "0501111111",
          password: testPassword,
          name: "Other",
        });
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should reject invalid phone", async () => {
      const { ctx } = createContext();
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.auth.register({
          username: `newuser_${Date.now()}`,
          phone: "12",
          password: testPassword,
          name: "Test",
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
          phone: "0500000002",
          password: "short",
          name: "Test",
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
        email: null,
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
