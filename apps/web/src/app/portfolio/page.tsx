import { redirect } from "next/navigation";

// The portfolio moved into the investor cabinet (ADR 0016).
export default function PortfolioPage() {
  redirect("/investor");
}
