CREATE TABLE "platform_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "farmer_profiles" ADD COLUMN "kyc_wallet" text;--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_one_self_cabinet" ON "user_roles" USING btree ("user_id") WHERE "role" in ('farmer', 'investor') and "granted_by" = "user_id";--> statement-breakpoint
-- Farmers approved before this migration: the approval went to their embedded wallet.
UPDATE "farmer_profiles" p SET "kyc_wallet" = w."address" FROM "wallets" w WHERE w."user_id" = p."user_id" AND w."kind" = 'privy-embedded' AND p."kyc_status" = 'approved' AND p."kyc_wallet" IS NULL;--> statement-breakpoint
-- A database marked production refuses dev-verifier identities from any process (local dev server, scripts).
CREATE FUNCTION "refuse_dev_identity_in_production"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."privy_did" LIKE 'did:dev:%' AND EXISTS (SELECT 1 FROM "platform_settings" WHERE "key" = 'environment' AND "value" = 'production') THEN
    RAISE EXCEPTION 'dev identities are not allowed in the production database' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "users_no_dev_identity_in_production" BEFORE INSERT OR UPDATE OF "privy_did" ON "users" FOR EACH ROW EXECUTE FUNCTION "refuse_dev_identity_in_production"();
