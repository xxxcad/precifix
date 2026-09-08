-- Global product and fiscal changes require independent review in every active channel.
-- Existing open channel-less items are expanded without deleting their audit record.

create or replace function private.enqueue_repricing(
  target_product_id uuid,
  target_marketplace_id uuid,
  queue_reason text,
  queue_source_type text,
  queue_source_id uuid
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if target_marketplace_id is null then
    insert into public.repricing_queue(product_id, marketplace_id, reason, source_type, source_id)
    select target_product_id, marketplace.id, queue_reason, queue_source_type, queue_source_id
    from public.marketplaces as marketplace
    where marketplace.active;
  else
    insert into public.repricing_queue(product_id, marketplace_id, reason, source_type, source_id)
    values (target_product_id, target_marketplace_id, queue_reason, queue_source_type, queue_source_id);
  end if;
end;
$$;

revoke all on function private.enqueue_repricing(uuid,uuid,text,text,uuid) from public, anon, authenticated;

with first_marketplace as (
  select id from public.marketplaces where active order by code limit 1
), expanded as (
  update public.repricing_queue as queue
  set marketplace_id = first_marketplace.id
  from first_marketplace
  where queue.marketplace_id is null
    and queue.status in ('OPEN', 'IN_PROGRESS')
  returning queue.product_id, queue.reason, queue.source_type, queue.source_id,
    queue.status, queue.created_at, first_marketplace.id as first_marketplace_id
)
insert into public.repricing_queue(product_id, marketplace_id, reason, source_type, source_id, status, created_at)
select expanded.product_id, marketplace.id, expanded.reason, expanded.source_type,
  expanded.source_id, expanded.status, expanded.created_at
from expanded
join public.marketplaces as marketplace
  on marketplace.active and marketplace.id <> expanded.first_marketplace_id;
