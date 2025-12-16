CREATE INDEX "IDX_app_action_item_id" ON "app_action" USING btree ("item_id" uuid_ops);--> statement-breakpoint

CREATE INDEX "IDX_item_validation_item_id" ON "item_validation" USING btree ("item_id" uuid_ops);--> statement-breakpoint

CREATE INDEX "IDX_item_validation_group_item_id" ON "item_validation_group" USING btree ("item_id" uuid_ops);--> statement-breakpoint

CREATE INDEX "IDX_app_action_account_id" ON "app_action" USING btree ("account_id" uuid_ops);--> statement-breakpoint

CREATE INDEX "IDX_item_validation_review_item_validation_id" ON "item_validation_review" USING btree ("item_validation_id" uuid_ops);--> statement-breakpoint

CREATE INDEX "IDX_item_validation_item_validation_group_id" ON "item_validation" USING btree ("item_validation_group_id" uuid_ops);--> statement-breakpoint

CREATE INDEX "IDX_item_membership_creator_id" ON "item_membership" USING btree ("creator_id" uuid_ops);--> statement-breakpoint

CREATE INDEX "IDX_item_category_item_path" ON "item_category" USING gist ("item_path" gist_ltree_ops);--> statement-breakpoint
 
ALTER TABLE "invitation" DROP CONSTRAINT "FK_dc1d92accde1c2fbb7e729e4dcc";--> statement-breakpoint

ALTER TABLE "invitation" DROP CONSTRAINT "invitation_item_path_item_path_fk";--> statement-breakpoint

ALTER TABLE "invitation" ADD CONSTRAINT "FK_invitation_item_path" FOREIGN KEY ("item_path") REFERENCES "public"."item"("path") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint

CREATE INDEX "IDX_invitation_item_path" ON "invitation" USING gist ("item_path" gist_ltree_ops);--> statement-breakpoint