-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Organizations (business/agency accounts)
create table public.organizations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  clerk_org_id text unique,
  stripe_customer_id text,
  subscription_status text,
  subscription_tier text,
  settings jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.organizations enable row level security;

-- Users (synced from Clerk)
create table public.users (
  id uuid default gen_random_uuid() primary key,
  clerk_id text unique not null,
  organization_id uuid references public.organizations(id) on delete set null,
  email text,
  role text default 'member',
  raw_json jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.users enable row level security;
create index idx_users_clerk_id on public.users (clerk_id);
create index idx_users_org_id on public.users (organization_id);

-- Google Business Accounts (connected GBP accounts)
create table public.google_accounts (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  google_account_email text not null,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  token_expires_at timestamptz not null,
  account_name text,
  account_type text,
  is_active boolean default true,
  last_sync_at timestamptz,
  sync_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.google_accounts enable row level security;
create index idx_google_accounts_org on public.google_accounts (organization_id);

-- Locations (Google Business locations)
create table public.locations (
  id uuid default gen_random_uuid() primary key,
  google_account_id uuid references public.google_accounts(id) on delete cascade not null,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  google_location_id text not null,
  name text not null,
  address text,
  phone text,
  website text,
  primary_category text,
  place_id text,
  maps_uri text,
  is_active boolean default true,
  review_count integer default 0,
  average_rating numeric(2,1) default 0,
  last_review_sync_at timestamptz,
  settings jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.locations enable row level security;
create unique index idx_locations_google_id on public.locations (google_location_id);
create index idx_locations_org on public.locations (organization_id);
create index idx_locations_account on public.locations (google_account_id);

-- Reviews
create table public.reviews (
  id uuid default gen_random_uuid() primary key,
  location_id uuid references public.locations(id) on delete cascade not null,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  google_review_id text not null,
  google_reviewer_id text,
  reviewer_name text,
  reviewer_profile_photo text,
  star_rating integer not null check (star_rating >= 1 and star_rating <= 5),
  comment text,
  review_time timestamptz not null,
  reply_text text,
  reply_time timestamptz,
  reply_author text,
  has_reply boolean default false,
  is_replied_by_us boolean default false,
  internal_notes text,
  assigned_to uuid references public.users(id) on delete set null,
  status text default 'new',
  raw_json jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.reviews enable row level security;
create unique index idx_reviews_google_id on public.reviews (google_review_id);
create index idx_reviews_location on public.reviews (location_id);
create index idx_reviews_org on public.reviews (organization_id);
create index idx_reviews_status on public.reviews (status);
create index idx_reviews_rating on public.reviews (star_rating);

-- Review Collection Campaigns
create table public.campaigns (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  location_id uuid references public.locations(id) on delete cascade,
  name text not null,
  type text not null,
  template_sms text,
  template_email_subject text,
  template_email_body text,
  trigger_type text default 'manual',
  is_active boolean default true,
  settings jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.campaigns enable row level security;
create index idx_campaigns_org on public.campaigns (organization_id);

-- Campaign Recipients (customers to request reviews from)
create table public.campaign_recipients (
  id uuid default gen_random_uuid() primary key,
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  customer_name text,
  customer_phone text,
  customer_email text,
  status text default 'pending',
  sent_at timestamptz,
  delivered_at timestamptz,
  clicked_at timestamptz,
  submitted_at timestamptz,
  error_message text,
  external_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.campaign_recipients enable row level security;
create index idx_recipients_campaign on public.campaign_recipients (campaign_id);
create index idx_recipients_org on public.campaign_recipients (organization_id);
create index idx_recipients_status on public.campaign_recipients (status);

-- Response Templates
create table public.response_templates (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  name text not null,
  content text not null,
  category text,
  is_default boolean default false,
  usage_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.response_templates enable row level security;
create index idx_templates_org on public.response_templates (organization_id);

-- Webhook Logs (for debugging)
create table public.webhook_logs (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  source text not null,
  event_type text,
  payload jsonb,
  status text default 'received',
  error_message text,
  created_at timestamptz default now()
);
alter table public.webhook_logs enable row level security;
create index idx_webhook_org on public.webhook_logs (organization_id);
create index idx_webhook_source on public.webhook_logs (source);

-- RLS Policies

-- Organizations: users see their own org
create policy "Users can view own organization" on public.organizations
  for select using (
    id in (select organization_id from public.users where clerk_id = (auth.jwt() ->> 'sub'))
  );

create policy "Org owners/admins can update" on public.organizations
  for update using (
    id in (select organization_id from public.users where clerk_id = (auth.jwt() ->> 'sub') and role in ('owner', 'admin'))
  );

-- Users: users see users in their org
create policy "Users can view org members" on public.users
  for select using (
    organization_id in (select organization_id from public.users where clerk_id = (auth.jwt() ->> 'sub'))
  );

create policy "Users can update own profile" on public.users
  for update using (
    clerk_id = (auth.jwt() ->> 'sub')
  );

-- Google Accounts: org members can view
create policy "Org members can view google accounts" on public.google_accounts
  for select using (
    organization_id in (select organization_id from public.users where clerk_id = (auth.jwt() ->> 'sub'))
  );

create policy "Org admins can manage google accounts" on public.google_accounts
  for all using (
    organization_id in (select organization_id from public.users where clerk_id = (auth.jwt() ->> 'sub') and role in ('owner', 'admin'))
  );

-- Locations: org members can view
create policy "Org members can view locations" on public.locations
  for select using (
    organization_id in (select organization_id from public.users where clerk_id = (auth.jwt() ->> 'sub'))
  );

create policy "Org admins can manage locations" on public.locations
  for all using (
    organization_id in (select organization_id from public.users where clerk_id = (auth.jwt() ->> 'sub') and role in ('owner', 'admin'))
  );

-- Reviews: org members can view
create policy "Org members can view reviews" on public.reviews
  for select using (
    organization_id in (select organization_id from public.users where clerk_id = (auth.jwt() ->> 'sub'))
  );

create policy "Org members can update reviews (reply, assign, notes)" on public.reviews
  for update using (
    organization_id in (select organization_id from public.users where clerk_id = (auth.jwt() ->> 'sub'))
  );

-- Campaigns: org members can view
create policy "Org members can view campaigns" on public.campaigns
  for select using (
    organization_id in (select organization_id from public.users where clerk_id = (auth.jwt() ->> 'sub'))
  );

create policy "Org admins can manage campaigns" on public.campaigns
  for all using (
    organization_id in (select organization_id from public.users where clerk_id = (auth.jwt() ->> 'sub') and role in ('owner', 'admin'))
  );

-- Campaign Recipients: org members can view
create policy "Org members can view recipients" on public.campaign_recipients
  for select using (
    organization_id in (select organization_id from public.users where clerk_id = (auth.jwt() ->> 'sub'))
  );

create policy "System can insert/update recipients" on public.campaign_recipients
  for all using (
    organization_id in (select organization_id from public.users where clerk_id = (auth.jwt() ->> 'sub') and role in ('owner', 'admin'))
  );

-- Response Templates: org members can view
create policy "Org members can view templates" on public.response_templates
  for select using (
    organization_id in (select organization_id from public.users where clerk_id = (auth.jwt() ->> 'sub'))
  );

create policy "Org admins can manage templates" on public.response_templates
  for all using (
    organization_id in (select organization_id from public.users where clerk_id = (auth.jwt() ->> 'sub') and role in ('owner', 'admin'))
  );

-- Webhook Logs: org admins can view
create policy "Org admins can view webhook logs" on public.webhook_logs
  for select using (
    organization_id in (select organization_id from public.users where clerk_id = (auth.jwt() ->> 'sub') and role in ('owner', 'admin'))
  );

-- Updated at trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

create trigger set_organizations_updated_at
  before update on public.organizations
  for each row execute procedure public.handle_updated_at();

create trigger set_users_updated_at
  before update on public.users
  for each row execute procedure public.handle_updated_at();

create trigger set_google_accounts_updated_at
  before update on public.google_accounts
  for each row execute procedure public.handle_updated_at();

create trigger set_locations_updated_at
  before update on public.locations
  for each row execute procedure public.handle_updated_at();

create trigger set_reviews_updated_at
  before update on public.reviews
  for each row execute procedure public.handle_updated_at();

create trigger set_campaigns_updated_at
  before update on public.campaigns
  for each row execute procedure public.handle_updated_at();

create trigger set_campaign_recipients_updated_at
  before update on public.campaign_recipients
  for each row execute procedure public.handle_updated_at();

create trigger set_response_templates_updated_at
  before update on public.response_templates
  for each row execute procedure public.handle_updated_at();