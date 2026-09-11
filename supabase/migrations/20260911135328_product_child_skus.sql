create table public.product_child_skus (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null,
  normalized_sku text generated always as (lower(trim(sku))) stored,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid not null default auth.uid() references auth.users(id),
  constraint product_child_skus_sku_not_blank check (length(trim(sku)) > 0),
  constraint product_child_skus_sku_length check (length(trim(sku)) <= 80),
  constraint product_child_skus_description_length check (description is null or length(description) <= 160),
  unique (normalized_sku)
);

create index product_child_skus_product_idx on public.product_child_skus(product_id);
create unique index products_sku_normalized_unique_idx on public.products(lower(trim(sku)));

create table public.product_child_sku_history (
  id bigint generated always as identity primary key,
  product_id uuid not null,
  child_sku_id uuid,
  action text not null check (action in ('CREATED','UPDATED','DELETED')),
  sku text not null,
  description text,
  previous_sku text,
  previous_description text,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);

create index product_child_sku_history_product_idx
  on public.product_child_sku_history(product_id, changed_at desc);

create or replace function private.validate_product_sku_collision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext(lower(trim(new.sku))));
  if exists (
    select 1 from public.product_child_skus
    where normalized_sku = lower(trim(new.sku))
  ) then
    raise exception 'O SKU % já está cadastrado como SKU filho.', trim(new.sku)
      using errcode = '23505';
  end if;
  new.sku := trim(new.sku);
  return new;
end;
$$;

create or replace function private.validate_child_sku_collision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.sku := trim(new.sku);
  new.description := nullif(trim(new.description), '');
  perform pg_advisory_xact_lock(hashtext(lower(new.sku)));
  if exists (
    select 1 from public.products
    where lower(trim(sku)) = lower(new.sku)
  ) then
    raise exception 'O SKU % já está cadastrado como SKU pai.', new.sku
      using errcode = '23505';
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create or replace function private.audit_product_child_sku()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.product_child_sku_history(
    product_id, child_sku_id, action, sku, description,
    previous_sku, previous_description, changed_by
  ) values (
    coalesce(new.product_id, old.product_id), coalesce(new.id, old.id),
    case tg_op when 'INSERT' then 'CREATED' when 'UPDATE' then 'UPDATED' else 'DELETED' end,
    case when tg_op = 'DELETE' then old.sku else new.sku end,
    case when tg_op = 'DELETE' then old.description else new.description end,
    case when tg_op in ('UPDATE','DELETE') then old.sku end,
    case when tg_op in ('UPDATE','DELETE') then old.description end,
    auth.uid()
  );
  return coalesce(new, old);
end;
$$;

create trigger validate_product_sku_collision
before insert or update of sku on public.products
for each row execute function private.validate_product_sku_collision();

create trigger validate_child_sku_collision
before insert or update of sku, description on public.product_child_skus
for each row execute function private.validate_child_sku_collision();

create trigger audit_product_child_sku
after insert or update or delete on public.product_child_skus
for each row execute function private.audit_product_child_sku();

alter table public.product_child_skus enable row level security;
alter table public.product_child_sku_history enable row level security;

revoke all on public.product_child_skus, public.product_child_sku_history from anon, authenticated;
grant select on public.product_child_skus, public.product_child_sku_history to authenticated;
grant insert, update, delete on public.product_child_skus to authenticated;

create policy internal_read_product_child_skus on public.product_child_skus
for select to authenticated using ((select auth.uid()) is not null);
create policy internal_write_product_child_skus on public.product_child_skus
for all to authenticated
using (private.has_any_role(array['analyst','admin']))
with check (private.has_any_role(array['analyst','admin']));
create policy internal_read_product_child_sku_history on public.product_child_sku_history
for select to authenticated using ((select auth.uid()) is not null);

revoke all on function private.validate_product_sku_collision(), private.validate_child_sku_collision(), private.audit_product_child_sku() from public, anon, authenticated;

create or replace function public.replace_product_child_skus(p_product_id uuid, p_items jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare item jsonb;
declare item_id uuid;
declare kept_ids uuid[] := array[]::uuid[];
begin
  if not private.has_any_role(array['analyst','admin']) then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  if not exists (select 1 from public.products where id = p_product_id) then
    raise exception 'Produto não encontrado' using errcode = 'P0002';
  end if;
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'Lista de SKUs filhos inválida' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    if nullif(trim(item ->> 'sku'), '') is null then
      raise exception 'SKU filho não pode ficar vazio' using errcode = '23514';
    end if;
    item_id := nullif(item ->> 'id', '')::uuid;
    if item_id is null then
      insert into public.product_child_skus(product_id, sku, description)
      values (p_product_id, item ->> 'sku', item ->> 'description')
      returning id into item_id;
    else
      update public.product_child_skus
      set sku = item ->> 'sku', description = item ->> 'description'
      where id = item_id and product_id = p_product_id
        and (sku is distinct from trim(item ->> 'sku') or description is distinct from nullif(trim(item ->> 'description'), ''));
      if not found and not exists (select 1 from public.product_child_skus where id = item_id and product_id = p_product_id) then
        raise exception 'SKU filho não pertence a este produto' using errcode = '42501';
      end if;
    end if;
    kept_ids := array_append(kept_ids, item_id);
  end loop;

  delete from public.product_child_skus
  where product_id = p_product_id and not (id = any(kept_ids));
end;
$$;

revoke all on function public.replace_product_child_skus(uuid,jsonb) from public, anon;
grant execute on function public.replace_product_child_skus(uuid,jsonb) to authenticated;

create or replace function public.list_repricing_history_with_query(
  p_scope text, p_query text default '', p_channel text default '', p_page integer default 1,
  p_page_size integer default 20, p_sort text default 'date', p_direction text default 'desc'
) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare payload jsonb;
declare safe_direction text := case when lower(p_direction) = 'asc' then 'asc' else 'desc' end;
declare safe_limit integer := least(20, greatest(1, coalesce(p_page_size, 20)));
declare safe_offset integer := (greatest(1, coalesce(p_page, 1)) - 1) * least(20, greatest(1, coalesce(p_page_size, 20)));
declare sort_expression text;
declare statement text;
begin
  if (select auth.uid()) is null or not exists (select 1 from public.profiles where id = (select auth.uid()) and active) then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  if p_scope not in ('pending','completed') then raise exception 'Escopo inválido' using errcode = '22023'; end if;
  sort_expression := case p_sort when 'product' then 'sku' when 'channel' then 'marketplace_name' when 'type' then 'type_label' when 'reason' then 'reason' when 'result' then 'resolved_by_name' else case when p_scope = 'completed' then 'resolved_at' else 'created_at' end end;
  statement := format($query$
    with filtered as materialized (
      select q.id, q.product_id, q.created_at, q.resolved_at, q.status, q.reason, q.source_type,
        p.sku, p.name as product_name, p.cost, s.name as supplier_name,
        coalesce(m.name, 'Todos') as marketplace_name, coalesce(pr.display_name, 'Usuário não identificado') as resolved_by_name,
        case
          when q.source_type = 'PRODUCT_COST_CHANGE' then 'Custo'
          when q.source_type = 'PRODUCT_FIXED_PRICE_CHANGE' then 'Preço tabelado'
          when q.source_type in ('PRODUCT_FISCAL_RULE_CHANGE','PRODUCT_TAX_CHANGE','FISCAL_RULE_CHANGE') then 'Fiscal'
          when q.source_type in ('PRODUCT_MARKETPLACE_COMMISSION_CHANGE','PRODUCT_MARKETPLACE_FIXED_FEE_CHANGE','PRODUCT_MARKETPLACE_LISTING_CHANGE','PRODUCT_MARKETPLACE_CHANGE','MARKETPLACE_CHANGE','MARKETPLACE_FEE_BAND_CHANGE','MARKETPLACE_FEE_RULE_CHANGE') then 'Comissão/Tarifa'
          when q.source_type in ('PRODUCT_MARKETPLACE_FREIGHT_CHANGE','PRODUCT_PACKAGING_CHANGE','MARKETPLACE_SHIPPING_RULE') then 'Frete/Embalagem'
          when q.source_type = 'PRODUCT_CHANGE' and lower(q.reason) similar to '%%(frete|peso|altura|largura|comprimento|dimens|embalagem|cubagem)%%' then 'Frete/Embalagem'
          when q.source_type = 'PRODUCT_CHANGE' and lower(q.reason) similar to '%%(custo)%%' then 'Custo'
          when q.source_type = 'PRODUCT_CHANGE' and lower(q.reason) similar to '%%(fiscal|icms|pis|cofins|ipi|st )%%' then 'Fiscal'
          when q.source_type = 'PRODUCT_CHANGE' then 'Cadastro/Status' else 'Outros' end as type_label
      from public.repricing_queue q join public.products p on p.id = q.product_id join public.suppliers s on s.id = p.supplier_id
      left join public.marketplaces m on m.id = q.marketplace_id left join public.profiles pr on pr.id = q.resolved_by
      where (($1 = 'pending' and q.status in ('OPEN','IN_PROGRESS')) or ($1 = 'completed' and q.status in ('RESOLVED','DISMISSED')))
        and (nullif(trim($2), '') is null or m.name = $2)
        and (nullif(trim($3), '') is null or p.sku ilike '%%' || trim($3) || '%%' or p.name ilike '%%' || trim($3) || '%%'
          or exists (select 1 from public.product_child_skus c where c.product_id = p.id and (c.sku ilike '%%' || trim($3) || '%%' or coalesce(c.description,'') ilike '%%' || trim($3) || '%%')))
    ), paged as (select * from filtered order by %s %s, id %s limit $4 offset $5)
    select jsonb_build_object('total', (select count(*) from filtered), 'items', coalesce((select jsonb_agg(to_jsonb(paged)) from paged), '[]'::jsonb))
  $query$, sort_expression, safe_direction, safe_direction);
  execute statement into payload using p_scope, p_channel, p_query, safe_limit, safe_offset;
  return payload;
end;
$$;

revoke all on function public.list_repricing_history_with_query(text,text,text,integer,integer,text,text) from public, anon;
grant execute on function public.list_repricing_history_with_query(text,text,text,integer,integer,text,text) to authenticated;
