"use client";

import { useAuth } from "../auth/auth-context";
import type { ObligationItem } from "./obligations";
import { SettlementActions } from "./settlement-actions";

/** Settlement actions with the signed-in farmer's Privy wallet. */
export function ObligationActions({ item }: { item: ObligationItem }) {
  const auth = useAuth();
  if (!auth.ready) return null;
  return <SettlementActions item={item} signer={auth.signer} now={Math.floor(Date.now() / 1000)} />;
}
