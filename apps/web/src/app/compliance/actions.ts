"use server";

import { RequestError } from "@/lib/errors";
import { arrangerChain } from "@/lib/server/chain-port";
import { serviceAction } from "@/lib/server/service-action";
import { decideFarmerKyc, decideInvestorKyc } from "@/lib/workflow/arranger";
import { revokeInvestor } from "@/lib/workflow/compliance";

const decision = (d: string) => {
  if (d !== "approved" && d !== "rejected") throw new RequestError("Unknown decision", 400);
  return d;
};

export const decideFarmerKycAction = async (farmerUserId: string, d: "approved" | "rejected", note: string | null) =>
  serviceAction("compliance", d === "approved" ? "Issuer KYC approved and recorded on-chain" : "Issuer KYC rejected", (u, db) => decideFarmerKyc(db, u, farmerUserId, decision(d), note, arrangerChain()));

export const decideInvestorKycAction = async (investorUserId: string, d: "approved" | "rejected", note: string | null) =>
  serviceAction("compliance", d === "approved" ? "Investor KYC approved" : "Investor KYC rejected", (u, db) => decideInvestorKyc(db, u, investorUserId, decision(d), note, arrangerChain()));

export const revokeInvestorKycAction = async (investorUserId: string, reason: string) =>
  serviceAction("compliance", "KYC revoked; holdings frozen", (u, db) => revokeInvestor(db, u, investorUserId, reason, arrangerChain()));
