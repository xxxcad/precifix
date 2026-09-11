-- `replace_product_child_skus` is SECURITY INVOKER and calls the existing
-- authorization helper by its schema-qualified name. EXECUTE alone is not
-- sufficient: callers also need USAGE on the containing schema.
grant usage on schema private to authenticated;

-- Keep the private schema closed by default. Only the role helper explicitly
-- granted elsewhere remains executable by authenticated users.
revoke execute on all functions in schema private from authenticated;
grant execute on function private.has_any_role(text[]) to authenticated;
