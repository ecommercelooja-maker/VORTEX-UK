-- ============================================================================
-- CRM / e-commerce — schema multi-loja (store_id em todas as tabelas)
-- Executar no SQL Editor do Supabase (projeto único compartilhado pelas 3 lojas)
-- ou via `supabase db push`. Idempotente: pode ser executado mais de uma vez.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Função utilitária: mantém updated_at
-- ----------------------------------------------------------------------------
create or replace function public.crm_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ----------------------------------------------------------------------------
-- Lojas (registro criado pela própria aplicação a partir do STORE_ID)
-- ----------------------------------------------------------------------------
create table if not exists public.stores (
  id          text primary key,
  name        text not null,
  domain      text,
  currency    text not null default 'EUR',
  locale      text not null default 'fr-FR',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists trg_stores_updated on public.stores;
create trigger trg_stores_updated before update on public.stores
  for each row execute function public.crm_set_updated_at();

-- ----------------------------------------------------------------------------
-- Configurações por loja (editáveis no dashboard; env vars são o fallback)
-- ----------------------------------------------------------------------------
create table if not exists public.store_settings (
  store_id                         text primary key references public.stores(id) on delete cascade,
  abandoned_cart_timeout_minutes   integer not null default 30 check (abandoned_cart_timeout_minutes between 5 and 10080),
  cart_expire_days                 integer not null default 30 check (cart_expire_days between 1 and 365),
  automation_dedupe_hours          integer not null default 24 check (automation_dedupe_hours between 1 and 720),
  promotion_active                 boolean not null default false,
  promotion_start_at               timestamptz,
  promotion_end_at                 timestamptz,
  promotion_message                text,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now()
);
drop trigger if exists trg_store_settings_updated on public.store_settings;
create trigger trg_store_settings_updated before update on public.store_settings
  for each row execute function public.crm_set_updated_at();

-- ----------------------------------------------------------------------------
-- Clientes
-- ----------------------------------------------------------------------------
create table if not exists public.customers (
  id                          uuid primary key default gen_random_uuid(),
  store_id                    text not null references public.stores(id),
  name                        text,
  email                       text,
  phone                       text,
  whatsapp                    text,
  email_verified              boolean not null default false,
  phone_verified              boolean not null default false,
  marketing_email_opt_in      boolean not null default false,
  marketing_whatsapp_opt_in   boolean not null default false,
  marketing_sms_opt_in        boolean not null default false,
  total_orders                integer not null default 0,
  total_spent                 numeric(12,2) not null default 0,
  last_order_at               timestamptz,
  last_activity_at            timestamptz not null default now(),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint customers_contact_check check (email is not null or phone is not null)
);
create unique index if not exists customers_store_email_uniq on public.customers (store_id, email) where email is not null;
create unique index if not exists customers_store_phone_uniq on public.customers (store_id, phone) where phone is not null;
create index if not exists customers_store_activity_idx on public.customers (store_id, last_activity_at desc);
drop trigger if exists trg_customers_updated on public.customers;
create trigger trg_customers_updated before update on public.customers
  for each row execute function public.crm_set_updated_at();

-- ----------------------------------------------------------------------------
-- Carrinhos (ativos e abandonados)
-- ----------------------------------------------------------------------------
create table if not exists public.abandoned_carts (
  id                  uuid primary key default gen_random_uuid(),
  store_id            text not null references public.stores(id),
  customer_id         uuid references public.customers(id) on delete set null,
  session_id          text,
  external_cart_id    text,                      -- id do checkout externo (Umpi), quando houver
  source              text not null default 'site' check (source in ('site','checkout','manual')),
  email               text,
  phone               text,
  whatsapp            text,
  items               jsonb not null default '[]'::jsonb,
  product_summary     text,
  currency            text not null default 'EUR',
  subtotal            numeric(12,2) not null default 0,
  discount            numeric(12,2) not null default 0,
  total               numeric(12,2) not null default 0,
  checkout_url        text,
  status              text not null default 'active'
                      check (status in ('active','abandoned','recovered','manually_recovered','expired')),
  recovered_order_id  uuid,
  last_activity_at    timestamptz not null default now(),
  abandoned_at        timestamptz,
  recovered_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists carts_store_status_idx on public.abandoned_carts (store_id, status, last_activity_at desc);
create index if not exists carts_store_session_idx on public.abandoned_carts (store_id, session_id);
create index if not exists carts_customer_idx on public.abandoned_carts (customer_id);
create unique index if not exists carts_store_external_uniq on public.abandoned_carts (store_id, external_cart_id) where external_cart_id is not null;
drop trigger if exists trg_carts_updated on public.abandoned_carts;
create trigger trg_carts_updated before update on public.abandoned_carts
  for each row execute function public.crm_set_updated_at();

-- ----------------------------------------------------------------------------
-- Pedidos
-- ----------------------------------------------------------------------------
create table if not exists public.orders (
  id                          uuid primary key default gen_random_uuid(),
  store_id                    text not null references public.stores(id),
  customer_id                 uuid references public.customers(id) on delete set null,
  cart_id                     uuid references public.abandoned_carts(id) on delete set null,
  external_order_id           text not null,
  provider                    text not null default 'umpi',
  status                      text not null default 'pending'
                              check (status in ('pending','paid','processing','shipped','delivered','cancelled','refunded')),
  currency                    text not null default 'EUR',
  subtotal                    numeric(12,2) not null default 0,
  discount                    numeric(12,2) not null default 0,
  shipping                    numeric(12,2) not null default 0,
  total                       numeric(12,2) not null default 0,
  items                       jsonb not null default '[]'::jsonb,
  checkout_url                text,
  payment_status              text not null default 'pending'
                              check (payment_status in ('pending','paid','refused','refunded','chargeback')),
  payment_method              text,
  payment_confirmed_at        timestamptz,
  shipping_address            jsonb,
  customer_name               text,
  customer_email              text,
  customer_phone              text,
  -- rastreio (manual hoje; preparado para APIs de rastreamento)
  tracking_code               text,
  tracking_url                text,
  tracking_carrier            text,
  tracking_status             text
                              check (tracking_status is null or tracking_status in
                                ('label_created','shipped','in_transit','out_for_delivery','delivered','exception')),
  tracking_status_updated_at  timestamptz,
  tracking_added_at           timestamptz,
  tracking_sent_at            timestamptz,
  tracking_notification_sent  boolean not null default false,
  shipped_at                  timestamptz,
  estimated_delivery_at       timestamptz,
  delivered_at                timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint orders_store_external_uniq unique (store_id, external_order_id)
);
create index if not exists orders_store_created_idx on public.orders (store_id, created_at desc);
create index if not exists orders_store_status_idx on public.orders (store_id, status);
create index if not exists orders_customer_idx on public.orders (customer_id);
drop trigger if exists trg_orders_updated on public.orders;
create trigger trg_orders_updated before update on public.orders
  for each row execute function public.crm_set_updated_at();

-- ----------------------------------------------------------------------------
-- Eventos do cliente (timeline)
-- ----------------------------------------------------------------------------
create table if not exists public.customer_events (
  id            uuid primary key default gen_random_uuid(),
  store_id      text not null references public.stores(id),
  customer_id   uuid references public.customers(id) on delete cascade,
  cart_id       uuid references public.abandoned_carts(id) on delete set null,
  order_id      uuid references public.orders(id) on delete set null,
  session_id    text,
  event_type    text not null check (event_type in (
                  'customer_created','contact_captured',
                  'page_view','product_view','add_to_cart','checkout_started','checkout_abandoned',
                  'purchase','payment_confirmed','payment_refused','refund',
                  'email_sent','email_delivered','email_opened','email_clicked',
                  'whatsapp_sent','whatsapp_delivered','whatsapp_read',
                  'manual_contact','tracking_added','tracking_sent','tracking_status_updated',
                  'order_shipped','order_delivered','cart_recovered')),
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists customer_events_customer_idx on public.customer_events (customer_id, created_at desc);
create index if not exists customer_events_store_type_idx on public.customer_events (store_id, event_type, created_at desc);
create index if not exists customer_events_cart_idx on public.customer_events (cart_id);
create index if not exists customer_events_session_idx on public.customer_events (store_id, session_id, created_at desc);

-- ----------------------------------------------------------------------------
-- Automações (e-mail / WhatsApp / SMS)
-- ----------------------------------------------------------------------------
create table if not exists public.automation_events (
  id                    uuid primary key default gen_random_uuid(),
  store_id              text not null references public.stores(id),
  customer_id           uuid references public.customers(id) on delete cascade,
  cart_id               uuid references public.abandoned_carts(id) on delete set null,
  order_id              uuid references public.orders(id) on delete set null,
  channel               text not null check (channel in ('email','whatsapp','sms')),
  automation_type       text not null check (automation_type in
                          ('abandoned_cart','purchase_confirmation','promotion_reminder','tracking_notification','manual_followup')),
  status                text not null default 'pending'
                        check (status in ('pending','processing','sent','delivered','failed','cancelled')),
  -- chave de idempotência: impede duas automações iguais para o mesmo carrinho/pedido
  dedupe_key            text not null,
  recipient             text,
  subject               text,
  provider              text,
  provider_message_id   text,
  attempts              integer not null default 0,
  scheduled_at          timestamptz not null default now(),
  sent_at               timestamptz,
  delivered_at          timestamptz,
  opened_at             timestamptz,
  clicked_at            timestamptz,
  error_message         text,
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create unique index if not exists automation_dedupe_uniq on public.automation_events (dedupe_key);
create index if not exists automation_store_status_idx on public.automation_events (store_id, status, scheduled_at);
create index if not exists automation_cart_idx on public.automation_events (cart_id);
create index if not exists automation_order_idx on public.automation_events (order_id);
create index if not exists automation_customer_idx on public.automation_events (customer_id, created_at desc);
drop trigger if exists trg_automation_updated on public.automation_events;
create trigger trg_automation_updated before update on public.automation_events
  for each row execute function public.crm_set_updated_at();

-- ----------------------------------------------------------------------------
-- Webhooks recebidos (payload bruto, idempotência e auditoria)
-- ----------------------------------------------------------------------------
create table if not exists public.webhook_events (
  id             uuid primary key default gen_random_uuid(),
  store_id       text not null references public.stores(id),
  provider       text not null,
  event_type     text,
  external_id    text,               -- id do evento no provedor ou hash do payload
  payload_hash   text not null,
  payload        jsonb not null,
  status         text not null default 'received' check (status in ('received','processed','ignored','error')),
  error_message  text,
  order_id       uuid references public.orders(id) on delete set null,
  received_at    timestamptz not null default now(),
  processed_at   timestamptz
);
create unique index if not exists webhook_events_hash_uniq on public.webhook_events (store_id, provider, payload_hash);
create index if not exists webhook_events_store_received_idx on public.webhook_events (store_id, received_at desc);

-- ----------------------------------------------------------------------------
-- Segurança: RLS ligado em tudo. Nenhuma policy para anon/authenticated —
-- somente o backend (service_role, nunca exposto no frontend) acessa os dados.
-- O dashboard central poderá usar service_role no servidor ou policies próprias.
-- ----------------------------------------------------------------------------
alter table public.stores            enable row level security;
alter table public.store_settings    enable row level security;
alter table public.customers         enable row level security;
alter table public.abandoned_carts   enable row level security;
alter table public.orders            enable row level security;
alter table public.customer_events   enable row level security;
alter table public.automation_events enable row level security;
alter table public.webhook_events    enable row level security;

-- ----------------------------------------------------------------------------
-- View de apoio ao CRM (contagem de carrinhos por cliente)
-- ----------------------------------------------------------------------------
create or replace view public.customer_overview as
select
  c.*,
  coalesce(ac.abandoned_count, 0)  as abandoned_carts_count,
  coalesce(ac.recovered_count, 0)  as recovered_carts_count
from public.customers c
left join (
  select customer_id,
         count(*) filter (where status = 'abandoned')                              as abandoned_count,
         count(*) filter (where status in ('recovered','manually_recovered'))      as recovered_count
  from public.abandoned_carts
  group by customer_id
) ac on ac.customer_id = c.id;

-- só o service_role (backend) acessa; a view fica junto porque é criada acima
revoke all on table
  public.stores, public.store_settings, public.customers, public.abandoned_carts, public.orders,
  public.customer_events, public.automation_events, public.webhook_events, public.customer_overview
from anon, authenticated;

-- ----------------------------------------------------------------------------
-- RPC atômica: incrementa totais do cliente ao confirmar pagamento
-- ----------------------------------------------------------------------------
create or replace function public.crm_apply_paid_order(p_customer_id uuid, p_total numeric, p_paid_at timestamptz)
returns void language sql as $$
  update public.customers
     set total_orders     = total_orders + 1,
         total_spent      = total_spent + coalesce(p_total, 0),
         last_order_at    = greatest(coalesce(last_order_at, p_paid_at), p_paid_at),
         last_activity_at = greatest(last_activity_at, p_paid_at)
   where id = p_customer_id;
$$;

-- RPC atômica: recalcula totais a partir dos pedidos pagos (estorno/chargeback)
create or replace function public.crm_recalculate_customer_totals(p_customer_id uuid)
returns void language sql as $$
  update public.customers c
     set total_orders = s.cnt,
         total_spent  = s.sum,
         last_order_at = s.last_at
    from (
      select count(*) as cnt, coalesce(sum(total),0) as sum, max(payment_confirmed_at) as last_at
        from public.orders
       where customer_id = p_customer_id and payment_status = 'paid'
    ) s
   where c.id = p_customer_id;
$$;
