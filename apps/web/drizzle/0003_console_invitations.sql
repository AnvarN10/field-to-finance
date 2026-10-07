CREATE TABLE "console_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"roles" text[] NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by" uuid,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	CONSTRAINT "console_invitations_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "console_invitations_roles" CHECK (cardinality("roles") > 0 and "roles" <@ array['arranger', 'compliance', 'scas', 'elevator', 'lab', 'regulator']::text[]),
	CONSTRAINT "console_invitations_email" CHECK ("email" = lower("email") and position('@' in "email") > 1)
);
--> statement-breakpoint
ALTER TABLE "console_invitations" ADD CONSTRAINT "console_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_invitations" ADD CONSTRAINT "console_invitations_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_invitations" ADD CONSTRAINT "console_invitations_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "console_invitations_one_open" ON "console_invitations" USING btree ("email") WHERE "accepted_at" is null and "revoked_at" is null;