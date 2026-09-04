-- Marketplace rules used by the pricing engine and signed supplier logos.
do $$
declare
  marketplace_record record;
  new_rule_set_id uuid;
begin
  for marketplace_record in
    select * from (values
      ('MERCADO_LIVRE', 'CLASSICO', 'Mercado Livre Clássico', 0.115::numeric),
      ('MERCADO_LIVRE', 'PREMIUM', 'Mercado Livre Premium', 0.165::numeric),
      ('AMAZON', 'PADRAO', 'Amazon padrão', 0.120::numeric)
    ) as rules(marketplace_code, listing_type, rule_name, percentage_rate)
  loop
    select rs.id into new_rule_set_id
      from public.marketplace_fee_rule_sets rs
      join public.marketplaces m on m.id = rs.marketplace_id
     where m.code = marketplace_record.marketplace_code
       and rs.listing_type = marketplace_record.listing_type
       and rs.status = 'PUBLISHED'
     order by rs.version desc limit 1;

    if new_rule_set_id is null then
      insert into public.marketplace_fee_rule_sets
        (marketplace_id, listing_type, version, name, effective_from, status, change_reason)
      select id, marketplace_record.listing_type, 1, marketplace_record.rule_name,
             date '2026-01-01', 'PUBLISHED', 'Regra inicial conferida nas planilhas de precificação'
        from public.marketplaces where code = marketplace_record.marketplace_code
      returning id into new_rule_set_id;

      insert into public.marketplace_fee_bands
        (rule_set_id, label, min_price, max_price, percentage_rate, fixed_fee, sort_order)
      values
        (new_rule_set_id, marketplace_record.rule_name, 0, null,
         marketplace_record.percentage_rate, 0, 1);
    end if;
    new_rule_set_id := null;
  end loop;
end $$;

drop policy if exists supplier_logos_authenticated_read on storage.objects;
create policy supplier_logos_authenticated_read
on storage.objects for select to authenticated
using (bucket_id = 'supplier-logos' and (select auth.uid()) is not null);
