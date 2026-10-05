CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_user_id" uuid NOT NULL,
	"crop" text NOT NULL,
	"grade" text NOT NULL,
	"volume_t" integer NOT NULL,
	"tokenized_share_bps" integer NOT NULL,
	"requested_usd" bigint NOT NULL,
	"proposed_coupon_bps" integer NOT NULL,
	"season" integer NOT NULL,
	"elevator" text NOT NULL,
	"lab" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"status_note" text,
	"project_address" text,
	"field_set_hash" text,
	"pool_id" text,
	"pool_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "applications_status_known" CHECK ("status" in ('draft', 'submitted', 'documents_review', 'kyc', 'field_verification', 'structuring', 'ready', 'open', 'funded', 'disbursed', 'in_season', 'harvest', 'settlement', 'closed', 'rejected', 'withdrawn'))
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tx_signature" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"application_id" uuid,
	"kind" text NOT NULL,
	"sha256" text NOT NULL,
	"bucket_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"review_note" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"replaced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_kind" CHECK ("kind" in ('insurance', 'land_act', 'financials', 'encumbrance', 'yields', 'imagery', 'kyc', 'other')),
	CONSTRAINT "documents_status" CHECK ("status" in ('pending', 'accepted', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "farmer_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"legal_name" text,
	"bin" text,
	"region" text,
	"contact" text,
	"kyc_status" text DEFAULT 'not_started' NOT NULL,
	"kyc_note" text,
	"kyc_decided_by" uuid,
	"kyc_decided_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "farmer_profiles_kyc" CHECK ("kyc_status" in ('not_started', 'pending', 'approved', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "investor_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"category" text,
	"questionnaire" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"kyc_status" text DEFAULT 'not_started' NOT NULL,
	"kyc_note" text,
	"risk_ack_at" timestamp with time zone,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "investor_profiles_kyc" CHECK ("kyc_status" in ('not_started', 'pending', 'approved', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "kfd_acceptances" (
	"investor_user_id" uuid NOT NULL,
	"pool_address" text NOT NULL,
	"document_hash" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kfd_acceptances_investor_user_id_pool_address_pk" PRIMARY KEY("investor_user_id","pool_address")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"granted_by" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_pk" PRIMARY KEY("user_id","role"),
	CONSTRAINT "user_roles_role" CHECK ("role" in ('farmer', 'investor', 'arranger'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"privy_did" text,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_privy_did_unique" UNIQUE("privy_did"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"address" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_kind" CHECK ("kind" in ('privy-embedded', 'phantom'))
);
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_farmer_user_id_users_id_fk" FOREIGN KEY ("farmer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farmer_profiles" ADD CONSTRAINT "farmer_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farmer_profiles" ADD CONSTRAINT "farmer_profiles_kyc_decided_by_users_id_fk" FOREIGN KEY ("kyc_decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investor_profiles" ADD CONSTRAINT "investor_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investor_profiles" ADD CONSTRAINT "investor_profiles_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kfd_acceptances" ADD CONSTRAINT "kfd_acceptances_investor_user_id_users_id_fk" FOREIGN KEY ("investor_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "applications_farmer" ON "applications" USING btree ("farmer_user_id");--> statement-breakpoint
CREATE INDEX "applications_status" ON "applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "audit_created" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_target" ON "audit_log" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "documents_application" ON "documents" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "documents_owner" ON "documents" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "documents_sha" ON "documents" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "notifications_user" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wallets_user" ON "wallets" USING btree ("user_id");