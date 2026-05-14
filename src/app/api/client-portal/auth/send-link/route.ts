import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanySettings, sendInviteEmail } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Find all client records with this email across all orgs
    const clients = await prisma.client.findMany({
      where: { email, isArchived: false },
      select: { id: true, name: true, organizationId: true },
    });

    if (clients.length === 0) {
      // Generic response — don't leak whether email exists
      return NextResponse.json({
        message: "If this email is registered, a login link has been sent.",
      });
    }

    // For each client-org pair, create a ClientAuth record and send email
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    for (const client of clients) {
      // Invalidate previous tokens for this client
      await prisma.clientAuth.deleteMany({
        where: { clientId: client.id },
      });

      await prisma.clientAuth.create({
        data: {
          email,
          token,
          tokenExpiresAt: expiresAt,
          clientId: client.id,
          organizationId: client.organizationId,
        },
      });
    }

    // Send one magic link email (token works for all orgs)
    const settings = await getCompanySettings(clients[0].organizationId);
    const baseUrl = process.env.APP_URL || "http://localhost:3000";
    const link = `${baseUrl}/api/client-portal/auth/verify?token=${token}`;

    const html = `<div style="font-family:sans-serif;padding:20px">
      <h2>Login to ${settings.companyName}</h2>
      <p>Click the button below to sign in to your client portal.</p>
      <p><a href="${link}" style="padding:10px 20px;background:#6366f1;color:white;text-decoration:none;border-radius:6px">Sign In</a></p>
      <p style="color:#666;font-size:14px;margin-top:20px">This link expires in 15 minutes and can only be used once.</p>
    </div>`;

    try {
      const { Resend } = await import("resend");
      if (settings.resendApiKey) {
        const resend = new Resend(settings.resendApiKey);
        const sender = settings.senderEmail
          ? `${settings.companyName} <${settings.senderEmail}>`
          : `${settings.companyName} <noreply@projectbill.mrndev.me>`;
        await resend.emails.send({
          from: sender,
          to: [email],
          subject: `Sign in to ${settings.companyName} Client Portal`,
          html,
        });
      } else {
        console.log(`[MOCK MAGIC LINK] To: ${email} | Link: ${link}`);
      }
    } catch (e) {
      console.error("Failed to send magic link:", e);
    }

    return NextResponse.json({
      message: "If this email is registered, a login link has been sent.",
    });
  } catch (error) {
    console.error("Failed to send magic link:", error);
    return NextResponse.json({ error: "Failed to send login link" }, { status: 500 });
  }
}
