/**
 * JWT active-tenant validation tests.
 *
 * The jwt callback must re-validate organization membership on every call:
 * - update candidates without membership are dropped (stale JWT after revoke)
 * - valid membership swaps are applied
 * - plain requests revalidate the existing token org
 * - login defaults to user.defaultOrganizationId
 */

jest.mock("@/lib/prisma", () => {
  const memberships = new Map<string, any>();
  const set = (userId: string, organizationId: string, value: any) =>
    memberships.set(`${userId}:${organizationId}`, value);
  const get = (userId: string, organizationId: string) =>
    memberships.get(`${userId}:${organizationId}`) ?? null;
  return {
    __setMembership: set,
    prisma: {
      organizationMember: {
        findUnique: jest.fn(({ where }: any) => {
          const k = where.userId_organizationId;
          return get(k.userId, k.organizationId);
        }),
      },
    },
  };
});

import { authConfig } from "@/auth.config";
import * as prismaModule from "@/lib/prisma";

const prisma = (prismaModule as any).prisma;
const setMembership = (prismaModule as any).__setMembership as (
  userId: string,
  organizationId: string,
  value: { id: string } | null
) => void;

const member = (id: string) => ({ id });
const jwtCallback = authConfig.callbacks!.jwt as (
  args: {
    token: any;
    user?: any;
    trigger?: string;
    session?: any;
  }
) => Promise<any>;

describe("jwt callback active tenant validation", () => {
  beforeEach(() => {
    (prisma.organizationMember.findUnique as jest.Mock).mockClear();
  });

  it("drops an update candidate without membership and keeps a still-valid token org", async () => {
    setMembership("u1", "orgB", null);
    setMembership("u1", "orgA", member("m1"));

    const token = await jwtCallback({
      token: { id: "u1", activeOrganizationId: "orgA" },
      trigger: "update",
      session: { activeOrganizationId: "orgB" },
    });

    expect(token.activeOrganizationId).toBe("orgA");
  });

  it("applies an update candidate the user is a member of", async () => {
    setMembership("u1", "orgB", member("m2"));

    const token = await jwtCallback({
      token: { id: "u1", activeOrganizationId: "orgA" },
      trigger: "update",
      session: { activeOrganizationId: "orgB" },
    });

    expect(token.activeOrganizationId).toBe("orgB");
  });

  it("revalidates the token org on ordinary requests and drops it after revoke", async () => {
    setMembership("u1", "orgA", null);

    const token = await jwtCallback({
      token: { id: "u1", activeOrganizationId: "orgA" },
    });

    expect(token.activeOrganizationId).toBeUndefined();
  });

  it("keeps a revalidated token org the user is still a member of", async () => {
    setMembership("u1", "orgA", member("m1"));

    const token = await jwtCallback({
      token: { id: "u1", activeOrganizationId: "orgA" },
    });

    expect(token.activeOrganizationId).toBe("orgA");
  });

  it("sets the default organization at login", async () => {
    setMembership("u1", "orgA", member("m1"));

    const token = await jwtCallback({
      token: { id: "u1" },
      user: { id: "u1", defaultOrganizationId: "orgA" },
    });

    expect(token.activeOrganizationId).toBe("orgA");
  });

  it("does not pick an arbitrary org when an update carries none", async () => {
    setMembership("u1", "orgA", member("m1"));

    const token = await jwtCallback({
      token: { id: "u1", activeOrganizationId: "orgA" },
      trigger: "update",
      session: {},
    });

    expect(token.activeOrganizationId).toBe("orgA");
  });
});
