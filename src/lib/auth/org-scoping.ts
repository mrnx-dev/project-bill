import { AuthError } from "./org-rbac";
import { prisma } from "@/lib/prisma";

/**
 * Creates a scoped query builder that auto-injects organizationId.
 * Prevents cross-org data leaks by eliminating "forgot the filter" bugs.
 * 
 * This is an explicit alternative to the RLS extension — used primarily
 * in route handlers where orgId comes from requireOrgRole().
 */
export function orgQuery(orgId: string) {
  if (!orgId) throw new AuthError(500, "orgQuery: orgId is required");

  const scope = { organizationId: orgId };

  return {
    findMany: <T>(model: any, args?: any): Promise<T[]> =>
      model.findMany({ ...args, where: { ...args?.where, ...scope } }),

    findFirst: <T>(model: any, args?: any): Promise<T | null> =>
      model.findFirst({ ...args, where: { ...args?.where, ...scope } }),

    create: <T>(model: any, args: any): Promise<T> =>
      model.create({
        ...args,
        data: { ...args.data, organizationId: orgId },
      }),

    update: async <T>(model: any, args: any): Promise<T> => {
      // Verify record belongs to org BEFORE update
      const record = await model.findUnique({ where: args.where });
      if (!record || record.organizationId !== orgId) {
        throw new AuthError(404, "Record not found");
      }
      return model.update({
        ...args,
        where: { ...args.where },
        data: { ...args.data },
      });
    },

    delete: async <T>(model: any, args: any): Promise<T> => {
      const record = await model.findUnique({ where: args.where });
      if (!record || record.organizationId !== orgId) {
        throw new AuthError(404, "Record not found");
      }
      return model.delete({ ...args, where: { ...args.where } });
    },
  };
}