-- proposals table for "Предложить услугу" feature on MiniLIT
-- Drop first to allow re-run
drop table if exists proposals cascade;

create table proposals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references jobs(id) on delete cascade,
  freelancer_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text not null,
  price int not null check (price >= 0),
  deadline text not null,
  video_url text,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now()
);

create index proposals_project_idx on proposals(project_id, created_at desc);
create index proposals_freelancer_idx on proposals(freelancer_id, created_at desc);

-- RLS
alter table proposals enable row level security;

drop policy if exists "proposals: insert own"             on proposals;
drop policy if exists "proposals: read own as freelancer" on proposals;
drop policy if exists "proposals: read for own project"   on proposals;
drop policy if exists "proposals: update own as freelancer" on proposals;
drop policy if exists "proposals: update as project owner" on proposals;

-- Freelancers can only insert proposals authored by themselves
create policy "proposals: insert own" on proposals for insert
  with check (auth.uid() = freelancer_id);

-- Freelancer can read their own proposals
create policy "proposals: read own as freelancer" on proposals for select
  using (auth.uid() = freelancer_id);

-- Project owner (client) can read proposals for their projects
create policy "proposals: read for own project" on proposals for select
  using (
    exists (
      select 1 from jobs j
      where j.id = proposals.project_id and j.client_id = auth.uid()
    )
  );

-- Freelancer can edit/withdraw their own proposal
create policy "proposals: update own as freelancer" on proposals for update
  using (auth.uid() = freelancer_id)
  with check (auth.uid() = freelancer_id);

-- Project owner can update status (accept/reject) for proposals on their project
create policy "proposals: update as project owner" on proposals for update
  using (
    exists (
      select 1 from jobs j
      where j.id = proposals.project_id and j.client_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from jobs j
      where j.id = proposals.project_id and j.client_id = auth.uid()
    )
  );

-- include in realtime publication so list updates live
alter publication supabase_realtime add table proposals;
