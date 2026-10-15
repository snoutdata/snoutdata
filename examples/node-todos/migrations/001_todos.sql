-- A table for the example. `npx snoutdata db push` runs each file in migrations/ once.
create table if not exists public.todos (
	id bigint generated always as identity primary key,
	note text not null,
	done boolean not null default false,
	created_at timestamptz not null default now()
);

-- Row-level security on, with no policies: the anon key can read nothing. This script is
-- server-side and uses the service_role key, which bypasses row-level security.
alter table public.todos enable row level security;
