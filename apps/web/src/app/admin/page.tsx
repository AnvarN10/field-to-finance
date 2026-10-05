import { redirect } from "next/navigation";

// The password-protected demo console became the arranger cabinet (ADR 0016).
export default function AdminPage() {
  redirect("/arranger");
}
