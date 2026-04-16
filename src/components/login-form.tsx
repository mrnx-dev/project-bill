"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionState } from "react";
import { loginAction } from "@/app/(auth)/login/actions";
import { env } from "@/lib/env";
import { signIn } from "next-auth/react";
import { LogIn } from "lucide-react";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, undefined);

  const isManagedMode = env.DEPLOYMENT_MODE === "managed";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Login</CardTitle>
        <CardDescription>
          {isManagedMode
            ? "Use your central account to login"
            : "Enter your email below to login to your account"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isManagedMode ? (
          <div className="flex flex-col gap-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => signIn("casdoor", { callbackUrl: "/" })}
            >
              <LogIn className="mr-2 h-4 w-4" />
              Login with Casdoor
            </Button>
          </div>
        ) : (
          <form action={formAction}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  required
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                </div>
                <Input id="password" name="password" type="password" placeholder="Enter your password" required />
              </div>
              {state?.message && (
                <p className="text-sm font-medium text-destructive">
                  {state.message}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? "Logging in..." : "Login"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
