import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Demo console", robots: { index: false } };

export default function AdminLogin() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Demo console</h1>
      <p className="max-w-prose text-muted-foreground">Issuer, compliance and SCAS stub actions for the devnet demo. Keys stay on the server.</p>
      <LoginForm />
    </div>
  );
}
