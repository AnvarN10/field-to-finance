ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_role";--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "acting_role" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "link" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "dedupe_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_dedupe" ON "notifications" USING btree ("dedupe_key") WHERE "dedupe_key" is not null;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role" CHECK ("role" in ('farmer', 'investor', 'arranger', 'compliance', 'scas', 'elevator', 'lab', 'regulator'));