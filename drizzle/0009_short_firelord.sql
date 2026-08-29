CREATE TABLE "email_verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "email_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- 손으로 덧붙인 백필. DEFAULT false 그대로 두면 이 마이그레이션 이전에 가입한 모든 계정이
-- (시드 데모 계정 포함) 즉시 로그인 불가로 잠긴다. 인증 요구는 이 시점 이후 신규 가입에만
-- 적용한다는 결정(changelog 2026-08-29 D-02 반전)을 SQL로 옮긴 것.
UPDATE "user" SET "email_verified" = true;--> statement-breakpoint
ALTER TABLE "email_verification" ADD CONSTRAINT "email_verification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_verification_user_idx" ON "email_verification" USING btree ("user_id","created_at");