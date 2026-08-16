import { env } from "./env";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { getOrgContext, applyTenantScope } from "./rls";

const prismaClientSingleton = () => {
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const baseClient = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = baseClient;

const scopedClient = baseClient.$extends({
  query: {
    $allModels: {
      findUnique({ model, args, query }) {
        return query(applyTenantScope(model, args, getOrgContext(), "where"));
      },
      findFirst({ model, args, query }) {
        return query(applyTenantScope(model, args, getOrgContext(), "where"));
      },
      findFirstOrThrow({ model, args, query }) {
        return query(applyTenantScope(model, args, getOrgContext(), "where"));
      },
      findMany({ model, args, query }) {
        return query(applyTenantScope(model, args, getOrgContext(), "where"));
      },
      findUniqueOrThrow({ model, args, query }) {
        return query(applyTenantScope(model, args, getOrgContext(), "where"));
      },
      count({ model, args, query }) {
        return query(applyTenantScope(model, args, getOrgContext(), "where"));
      },
      update({ model, args, query }) {
        return query(applyTenantScope(model, args, getOrgContext(), "where"));
      },
      updateMany({ model, args, query }) {
        return query(applyTenantScope(model, args, getOrgContext(), "where"));
      },
      delete({ model, args, query }) {
        return query(applyTenantScope(model, args, getOrgContext(), "where"));
      },
      deleteMany({ model, args, query }) {
        return query(applyTenantScope(model, args, getOrgContext(), "where"));
      },
      create({ model, args, query }) {
        return query(applyTenantScope(model, args, getOrgContext(), "data"));
      },
      createMany({ model, args, query }) {
        return query(applyTenantScope(model, args, getOrgContext(), "dataMany"));
      },
      aggregate({ model, args, query }) {
        return query(applyTenantScope(model, args, getOrgContext(), "where"));
      },
      groupBy({ model, args, query }) {
        return query(applyTenantScope(model, args, getOrgContext(), "where"));
      },
    },
  },
}) as unknown as PrismaClient;

export const prisma = scopedClient;
