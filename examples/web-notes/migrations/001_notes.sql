-- Each signed-in user sees and writes only their own notes. `npx snoutdata db push` runs each
-- file in migrations/ once.
create table if not exists public.notes (
	id bigint generated always as identity primary key,
	owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
	body text not null,
	created_at timestamptz not null default now()
);

alter table public.notes enable row level security;

-- auth.uid() is the user whose session made the request, so the anon key in the page can only
-- ever reach the signed-in user's rows.
create policy "read own notes" on public.notes
	for select to authenticated using (owner_id = auth.uid());

create policy "write own notes" on public.notes
	for insert to authenticated with check (owner_id = auth.uid());

create policy "delete own notes" on public.notes
	for delete to authenticated using (owner_id = auth.uid());
