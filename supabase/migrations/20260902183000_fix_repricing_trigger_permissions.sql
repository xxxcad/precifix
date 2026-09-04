-- Trigger helpers run as the migration owner so authenticated users do not need
-- direct access to the private schema. Every helper already uses an empty
-- search_path and fully-qualified object names.
alter function private.enqueue_repricing(uuid, uuid, text, text, uuid) security definer;
alter function private.track_product_repricing() security definer;
alter function private.track_product_marketplace_repricing() security definer;
alter function private.queue_marketplace_products(uuid, text, text, uuid) security definer;
alter function private.track_fee_rule_repricing() security definer;
alter function private.track_fiscal_rule_repricing() security definer;

revoke all on function private.enqueue_repricing(uuid, uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function private.track_product_repricing() from public, anon, authenticated;
revoke all on function private.track_product_marketplace_repricing() from public, anon, authenticated;
revoke all on function private.queue_marketplace_products(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function private.track_fee_rule_repricing() from public, anon, authenticated;
revoke all on function private.track_fiscal_rule_repricing() from public, anon, authenticated;
