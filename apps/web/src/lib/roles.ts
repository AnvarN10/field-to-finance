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

/** Each role's cabinet. Elevator and laboratory share one cabinet. */
export const ROLE_CABINET: Record<Role, string> = {
  farmer: "/farmer",
  investor: "/investor",
  arranger: "/arranger",
  compliance: "/compliance",
  scas: "/scas",
  elevator: "/elevator",
  lab: "/elevator",
  regulator: "/regulator",
};

/** Landing order when an account holds several roles: the arranger first, then the self-service and service cabinets. */
export const ROLE_PRIORITY: Role[] = ["arranger", "farmer", "investor", "compliance", "scas", "elevator", "lab", "regulator"];
