CREATE INDEX "IDX_gist_item_path_deleted_at" ON "item" USING gist ("path" gist_ltree_ops) WHERE "item"."deleted_at" is null;
