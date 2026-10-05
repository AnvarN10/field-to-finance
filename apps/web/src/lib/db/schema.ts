import { sql } from "drizzle-orm";
import { bigint, check, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { APPLICATION_STATUSES, type ApplicationStatus } from "../application-status";

/** Service roles (ADR 0017): granted only by an arranger; an arranger may act for any of them. */
export const SERVICE_ROLES = ["compliance", "scas", "elevator", "lab", "regulator"] as const;
export type ServiceRole = (typeof SERVICE_ROLES)[number];
export const ROLES = ["farmer", "investor", "arranger", ...SERVICE_ROLES] as const;
export type Role = (typeof ROLES)[number];
export const KYC_STATUSES = ["not_started", "pending", "approved", "rejected"] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];
export const DOCUMENT_KINDS = ["insurance", "land_act", "financials", "encumbrance", "yields", "imagery", "kyc", "other"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
export const DOCUMENT_STATUSES = ["pending", "accepted", "rejected"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];
export const INVESTOR_CATEGORIES = ["professional", "retail", "institutional"] as const;
export type InvestorCategory = (typeof INVESTOR_CATEGORIES)[number];
export const WALLET_KINDS = ["privy-embedded", "phantom"] as const;
export type WalletKind = (typeof WALLET_KINDS)[number];

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
// The values are compile-time constants above, never user input.
const oneOf = (column: string, values: readonly string[]) => sql.raw(`"${column}" in (${values.map((v) => `'${v}'`).join(", ")})`);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  privyDid: text("privy_did").unique(),
  email: text("email").notNull().unique(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<Role>().notNull(),
    grantedBy: uuid("granted_by").references(() => users.id, { onDelete: "set null" }),
    grantedAt: ts("granted_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.role] }),
    check("user_roles_role", oneOf("role", ROLES)),
    // Self-service gives one cabinet per account; the database refuses a second self-chosen one even under a race.
    uniqueIndex("user_roles_one_self_cabinet").on(t.userId).where(sql`"role" in ('farmer', 'investor') and "granted_by" = "user_id"`),
  ],
);

export const wallets = pgTable(
  "wallets",
  {
    address: text("address").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").$type<WalletKind>().notNull(),
    verifiedAt: ts("verified_at").notNull().defaultNow(),
  },
  (t) => [index("wallets_user").on(t.userId), check("wallets_kind", oneOf("kind", WALLET_KINDS))],
);

export const farmerProfiles = pgTable(
  "farmer_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    legalName: text("legal_name"),
    bin: text("bin"),
    region: text("region"),
    contact: text("contact"),
    kycStatus: text("kyc_status").$type<KycStatus>().notNull().default("not_started"),
    kycNote: text("kyc_note"),
    /** The wallet issuer KYC approved on-chain: the only wallet that may register the project and be the issuer of record. */
    kycWallet: text("kyc_wallet"),
    kycDecidedBy: uuid("kyc_decided_by").references(() => users.id, { onDelete: "set null" }),
    kycDecidedAt: ts("kyc_decided_at"),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [check("farmer_profiles_kyc", oneOf("kyc_status", KYC_STATUSES))],
);

export const investorProfiles = pgTable(
  "investor_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    category: text("category").$type<InvestorCategory>(),
    questionnaire: jsonb("questionnaire").$type<Record<string, unknown>>().notNull().default({}),
    kycStatus: text("kyc_status").$type<KycStatus>().notNull().default("not_started"),
    kycNote: text("kyc_note"),
    riskAckAt: ts("risk_ack_at"),
    decidedBy: uuid("decided_by").references(() => users.id, { onDelete: "set null" }),
    decidedAt: ts("decided_at"),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [check("investor_profiles_kyc", oneOf("kyc_status", KYC_STATUSES))],
);

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    farmerUserId: uuid("farmer_user_id")
      .notNull()
      .references(() => users.id),
    crop: text("crop").notNull(),
    grade: text("grade").notNull(),
    volumeT: integer("volume_t").notNull(),
    tokenizedShareBps: integer("tokenized_share_bps").notNull(),
    requestedUsd: bigint("requested_usd", { mode: "number" }).notNull(),
    proposedCouponBps: integer("proposed_coupon_bps").notNull(),
    season: integer("season").notNull(),
    elevator: text("elevator").notNull(),
    lab: text("lab").notNull(),
    status: text("status").$type<ApplicationStatus>().notNull().default("draft"),
    statusNote: text("status_note"),
    projectAddress: text("project_address"),
    fieldSetHash: text("field_set_hash"),
    poolId: text("pool_id"),
    poolAddress: text("pool_address"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("applications_farmer").on(t.farmerUserId),
    index("applications_status").on(t.status),
    check("applications_status_known", oneOf("status", APPLICATION_STATUSES)),
  ],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id),
    applicationId: uuid("application_id").references(() => applications.id),
    kind: text("kind").$type<DocumentKind>().notNull(),
    sha256: text("sha256").notNull(),
    bucketKey: text("bucket_key").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    status: text("status").$type<DocumentStatus>().notNull().default("pending"),
    reviewNote: text("review_note"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: ts("reviewed_at"),
    /** Set when a newer upload of the same kind replaces this one; replaced rows stay as history. */
    replacedAt: ts("replaced_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("documents_application").on(t.applicationId),
    index("documents_owner").on(t.ownerUserId),
    index("documents_sha").on(t.sha256),
    check("documents_kind", oneOf("kind", DOCUMENT_KINDS)),
    check("documents_status", oneOf("status", DOCUMENT_STATUSES)),
  ],
);

export const kfdAcceptances = pgTable(
  "kfd_acceptances",
  {
    investorUserId: uuid("investor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    poolAddress: text("pool_address").notNull(),
    documentHash: text("document_hash").notNull(),
    acceptedAt: ts("accepted_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.investorUserId, t.poolAddress] })],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    /** The service role the actor acted as (an arranger acting for compliance, a SCAS partner in its own role). */
    actingRole: text("acting_role"),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    txSignature: text("tx_signature"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("audit_created").on(t.createdAt), index("audit_target").on(t.targetType, t.targetId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    /** In-app path the notification opens, e.g. `/investor/pools/9`. */
    link: text("link"),
    /** Set for notifications that must exist at most once (maturity reminders); unique when present. */
    dedupeKey: text("dedupe_key"),
    readAt: ts("read_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("notifications_user").on(t.userId), uniqueIndex("notifications_dedupe").on(t.dedupeKey).where(sql`"dedupe_key" is not null`)],
);

export type UserRow = typeof users.$inferSelect;
export type ApplicationRow = typeof applications.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type FarmerProfileRow = typeof farmerProfiles.$inferSelect;
export type InvestorProfileRow = typeof investorProfiles.$inferSelect;
export type AuditRow = typeof auditLog.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;

/**
 * Per-database settings. `environment = production` marks the production database: a trigger (migration 0001) then
 * refuses dev-verifier identities (`did:dev:*`), whatever process connects.
 */
export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});
