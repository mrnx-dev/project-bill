import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import bcrypt from "bcryptjs";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { name: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error: any) {
    console.error("Profile fetch error:", error);
    return NextResponse.json({ error: "An error occurred." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, email, currentPassword, newPassword } = body;

    // Determine if this is a general info update or a password update
    const isPasswordUpdate = !!currentPassword && !!newPassword;
    const isInfoUpdate = !!name || !!email;

    if (!isPasswordUpdate && !isInfoUpdate) {
      return NextResponse.json(
        { error: "Nothing to update." },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (isPasswordUpdate) {
      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password,
      );

      if (!isPasswordValid) {
        return NextResponse.json(
          { error: "Incorrect current password." },
          { status: 400 },
        );
      }

      if (newPassword.length < 6) {
        return NextResponse.json(
          { error: "New password must be at least 6 characters long." },
          { status: 400 },
        );
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: session.user.id },
        data: { password: hashedPassword },
      });

      return NextResponse.json({ message: "Password updated successfully." });
    }

    if (isInfoUpdate) {
      // Check if email is being changed to an existing email
      if (email && email !== user.email) {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
          return NextResponse.json(
            { error: "Email already in use." },
            { status: 400 },
          );
        }
      }

      await prisma.user.update({
        where: { id: session.user.id },
        data: { name: name || user.name, email: email || user.email },
      });

      return NextResponse.json({
        message: "Profile information updated successfully.",
      });
    }

    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  } catch (error: any) {
    console.error("Profile update error:", error);
    return NextResponse.json({ error: "An error occurred." }, { status: 500 });
  }
}
