import type { Metadata } from "next";
import { FarmerApp } from "@/components/farmer/farmer-app";

export const metadata: Metadata = { title: "For farmers" };

export default function FarmerPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Finance your next season</h1>
        <p className="max-w-2xl text-muted-foreground">
          Upload your field boundaries and request working capital against 30% of your expected harvest. An independent verifier checks the fields before a pool is offered to investors.
        </p>
      </header>
      <FarmerApp />
    </div>
  );
}
