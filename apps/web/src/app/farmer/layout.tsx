import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth/auth-provider";

export default function FarmerLayout({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
