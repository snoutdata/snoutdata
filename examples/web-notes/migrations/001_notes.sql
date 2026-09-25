-- Each signed-in user sees and writes only their own notes. `npx snoutdata db push` runs each
-- file in migrations/ once.
create table if not exists public.notes (
	id bigint generated always as identity primary key,
	owner_id uuid not null default snout_identity.user_id() references snout_identity.people (id) on delete cascade,
	body text not null,
	created_at timestamptz not null default now()
);

alter table public.notes enable row level security;

-- snout_identity.user_id() is the user whose session made the request, so the app key in the page can only
-- ever reach the signed-in user's rows.
create policy "read own notes" on public.notes
	for select to snout_member using (owner_id = snout_identity.user_id());

create policy "write own notes" on public.notes
	for insert to snout_member with check (owner_id = snout_identity.user_id());

create policy "delete own notes" on public.notes
	for delete to snout_member using (owner_id = snout_identity.user_id());
