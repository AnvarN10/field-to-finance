import type { Role } from "./db/schema";

/** Sentence-case role names for the UI. */
export const ROLE_LABELS: Record<Role, string> = {
  farmer: "Farmer issuer",
  investor: "Investor",
  arranger: "Arranger",
  compliance: "Compliance",
  scas: "SCAS partner",
  elevator: "Elevator",
  lab: "Laboratory",
  regulator: "Regulator",
};
