import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth/auth-provider";

export default function InvestorLayout({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
