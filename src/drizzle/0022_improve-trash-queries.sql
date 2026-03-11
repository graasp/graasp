ANALYZE item;
ANALYZE item_memberships;
ANALYZE recycled_item_data;
CREATE INDEX CONCURRENTLY "IDX_btree_item_path" ON "item" USING btree ("path");
