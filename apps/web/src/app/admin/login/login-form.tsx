"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginAction } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, { error: null });
  return (
    <form action={action} className="flex max-w-sm flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Password
        <Input name="password" type="password" required autoComplete="current-password" className="h-10" />
      </label>
      {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? "Signing in" : "Sign in"}
      </Button>
    </form>
  );
}
