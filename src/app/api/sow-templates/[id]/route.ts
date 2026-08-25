import { NextResponse } from "next/server";
import { withTenantRls, getTenantCtx } from "@/lib/rls";

export const PUT = withTenantRls(async (req, ctx, tx) => {
  try {
    const tenant = getTenantCtx()!;
    const orgId = tenant.organizationId;
    const id = (await ctx.params).id as string;
    const body = await req.json();

    const template = await tx.sOWTemplate.update({
      where: { id, organizationId: orgId },
      data: { name: body.name, content: body.content },
    });

    return NextResponse.json(template);
  } catch (error) {
    return new NextResponse("Internal Error", { status: 500 });
  }
});

export const DELETE = withTenantRls(async (_req, ctx, tx) => {
  try {
    const tenant = getTenantCtx()!;
    const orgId = tenant.organizationId;
    const id = (await ctx.params).id as string;

    await tx.sOWTemplate.delete({ where: { id, organizationId: orgId } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return new NextResponse("Internal Error", { status: 500 });
  }
});