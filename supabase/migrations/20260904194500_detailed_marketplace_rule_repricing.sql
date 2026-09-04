create or replace function private.track_fee_rule_repricing()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare marketplace_id_value uuid; marketplace_name text; listing_name text; source uuid; reason text;
begin
  source:=coalesce(new.id,old.id);
  if tg_table_name='marketplace_fee_bands' then
    select rs.marketplace_id,m.name,rs.listing_type into marketplace_id_value,marketplace_name,listing_name
    from public.marketplace_fee_rule_sets rs join public.marketplaces m on m.id=rs.marketplace_id
    where rs.id=coalesce(new.rule_set_id,old.rule_set_id);
    if tg_op='INSERT' then
      reason:='A faixa tarifária '||new.label||' da '||marketplace_name||' ('||listing_name||') foi adicionada.';
      perform private.queue_marketplace_products(marketplace_id_value,reason,'MARKETPLACE_FEE_BAND_CHANGE',source);
    elsif tg_op='DELETE' then
      reason:='A faixa tarifária '||old.label||' da '||marketplace_name||' ('||listing_name||') foi removida.';
      perform private.queue_marketplace_products(marketplace_id_value,reason,'MARKETPLACE_FEE_BAND_CHANGE',source);
    else
      if old.label is distinct from new.label then perform private.queue_marketplace_products(marketplace_id_value,'O nome da faixa tarifária da '||marketplace_name||' mudou de '||old.label||' para '||new.label||'.','MARKETPLACE_FEE_BAND_CHANGE',source); end if;
      if old.min_price is distinct from new.min_price then perform private.queue_marketplace_products(marketplace_id_value,'O preço mínimo da faixa '||new.label||' da '||marketplace_name||' mudou de '||private.repricing_money(old.min_price)||' para '||private.repricing_money(new.min_price)||'.','MARKETPLACE_FEE_BAND_CHANGE',source); end if;
      if old.max_price is distinct from new.max_price then perform private.queue_marketplace_products(marketplace_id_value,'O preço máximo da faixa '||new.label||' da '||marketplace_name||' mudou de '||private.repricing_money(old.max_price)||' para '||private.repricing_money(new.max_price)||'.','MARKETPLACE_FEE_BAND_CHANGE',source); end if;
      if old.percentage_rate is distinct from new.percentage_rate then perform private.queue_marketplace_products(marketplace_id_value,'A comissão da faixa '||new.label||' da '||marketplace_name||' mudou de '||private.repricing_percent(old.percentage_rate)||' para '||private.repricing_percent(new.percentage_rate)||'.','MARKETPLACE_FEE_BAND_CHANGE',source); end if;
      if old.fixed_fee is distinct from new.fixed_fee then perform private.queue_marketplace_products(marketplace_id_value,'A tarifa fixa da faixa '||new.label||' da '||marketplace_name||' mudou de '||private.repricing_money(old.fixed_fee)||' para '||private.repricing_money(new.fixed_fee)||'.','MARKETPLACE_FEE_BAND_CHANGE',source); end if;
    end if;
  else
    marketplace_id_value:=coalesce(new.marketplace_id,old.marketplace_id);
    select name into marketplace_name from public.marketplaces where id=marketplace_id_value;
    if tg_op='INSERT' then perform private.queue_marketplace_products(marketplace_id_value,'A regra tarifária '||new.name||' da '||marketplace_name||' foi criada.','MARKETPLACE_FEE_RULE_CHANGE',source);
    elsif tg_op='DELETE' then perform private.queue_marketplace_products(marketplace_id_value,'A regra tarifária '||old.name||' da '||marketplace_name||' foi removida.','MARKETPLACE_FEE_RULE_CHANGE',source);
    else
      if old.listing_type is distinct from new.listing_type then perform private.queue_marketplace_products(marketplace_id_value,'A modalidade da regra '||new.name||' da '||marketplace_name||' mudou de '||old.listing_type||' para '||new.listing_type||'.','MARKETPLACE_FEE_RULE_CHANGE',source); end if;
      if old.status is distinct from new.status then perform private.queue_marketplace_products(marketplace_id_value,'O status da regra tarifária '||new.name||' da '||marketplace_name||' mudou de '||old.status||' para '||new.status||'.','MARKETPLACE_FEE_RULE_CHANGE',source); end if;
      if old.effective_from is distinct from new.effective_from then perform private.queue_marketplace_products(marketplace_id_value,'A vigência inicial da regra '||new.name||' da '||marketplace_name||' mudou de '||old.effective_from||' para '||new.effective_from||'.','MARKETPLACE_FEE_RULE_CHANGE',source); end if;
      if old.effective_to is distinct from new.effective_to then perform private.queue_marketplace_products(marketplace_id_value,'A vigência final da regra '||new.name||' da '||marketplace_name||' mudou de '||coalesce(old.effective_to::text,'sem data')||' para '||coalesce(new.effective_to::text,'sem data')||'.','MARKETPLACE_FEE_RULE_CHANGE',source); end if;
    end if;
  end if;
  return coalesce(new,old);
end;
$$;
revoke all on function private.track_fee_rule_repricing() from public,anon,authenticated;

create or replace function private.track_marketplace_repricing()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.shipping_mode is distinct from new.shipping_mode then perform private.queue_marketplace_products(new.id,'O modo de frete da '||new.name||' mudou de '||old.shipping_mode||' para '||new.shipping_mode||'.','MARKETPLACE_CHANGE',new.id); end if;
  if old.active is distinct from new.active then perform private.queue_marketplace_products(new.id,'O status da '||new.name||' mudou de '||case when old.active then 'Ativo' else 'Inativo' end||' para '||case when new.active then 'Ativo' else 'Inativo' end||'.','MARKETPLACE_CHANGE',new.id); end if;
  return new;
end;
$$;
revoke all on function private.track_marketplace_repricing() from public,anon,authenticated;
drop trigger if exists track_marketplace_repricing on public.marketplaces;
create trigger track_marketplace_repricing after update on public.marketplaces for each row execute function private.track_marketplace_repricing();
