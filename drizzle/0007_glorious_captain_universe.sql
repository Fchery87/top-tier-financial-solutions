CREATE TABLE "bureau_discrepancies" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"discrepancy_type" text NOT NULL,
	"field" text,
	"creditor_name" text,
	"account_number" text,
	"value_transunion" text,
	"value_experian" text,
	"value_equifax" text,
	"severity" text DEFAULT 'medium',
	"is_disputable" boolean DEFAULT true,
	"dispute_recommendation" text,
	"notes" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "consumer_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"credit_report_id" text,
	"bureau" text,
	"first_name" text,
	"middle_name" text,
	"last_name" text,
	"suffix" text,
	"ssn_last_4" text,
	"date_of_birth" timestamp,
	"address_street" text,
	"address_city" text,
	"address_state" text,
	"address_zip" text,
	"address_type" text,
	"employer" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fcra_compliance_items" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"negative_item_id" text,
	"credit_account_id" text,
	"item_type" text NOT NULL,
	"creditor_name" text NOT NULL,
	"date_of_first_delinquency" timestamp,
	"fcra_expiration_date" timestamp,
	"reporting_limit_years" integer,
	"days_until_expiration" integer,
	"is_past_limit" boolean DEFAULT false,
	"bureau" text,
	"dispute_status" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "bureau_discrepancies" ADD CONSTRAINT "bureau_discrepancies_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumer_profiles" ADD CONSTRAINT "consumer_profiles_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumer_profiles" ADD CONSTRAINT "consumer_profiles_credit_report_id_credit_reports_id_fk" FOREIGN KEY ("credit_report_id") REFERENCES "public"."credit_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fcra_compliance_items" ADD CONSTRAINT "fcra_compliance_items_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fcra_compliance_items" ADD CONSTRAINT "fcra_compliance_items_negative_item_id_negative_items_id_fk" FOREIGN KEY ("negative_item_id") REFERENCES "public"."negative_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fcra_compliance_items" ADD CONSTRAINT "fcra_compliance_items_credit_account_id_credit_accounts_id_fk" FOREIGN KEY ("credit_account_id") REFERENCES "public"."credit_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bureau_discrepancies_clientId_idx" ON "bureau_discrepancies" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "bureau_discrepancies_type_idx" ON "bureau_discrepancies" USING btree ("discrepancy_type");--> statement-breakpoint
CREATE INDEX "consumer_profiles_clientId_idx" ON "consumer_profiles" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "consumer_profiles_creditReportId_idx" ON "consumer_profiles" USING btree ("credit_report_id");--> statement-breakpoint
CREATE INDEX "fcra_compliance_items_clientId_idx" ON "fcra_compliance_items" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "fcra_compliance_items_expiration_idx" ON "fcra_compliance_items" USING btree ("fcra_expiration_date");