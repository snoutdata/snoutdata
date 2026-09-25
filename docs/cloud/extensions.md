---
id: extensions
title: Extensions, scheduled jobs and HTTP from SQL
sidebar_label: Extensions and cron jobs
description: Postgres extensions on a SnoutData Cloud project, scheduled SQL jobs with pg_cron (from the dashboard, SQL or the CLI), and outbound HTTP requests from SQL with pg_net.
---

# Extensions, scheduled jobs and HTTP from SQL

A project is a real Postgres, so it can be taught new things with extensions. Three of them get
their own sections here because people build on them: **pg_cron** runs SQL on a schedule,
**pg_net** makes HTTP requests from SQL, and the two together call a URL on a schedule.

The function names are the upstream ones (`cron.schedule`, `net.http_post`), so a snippet written
for another hosted Postgres that ships these extensions runs here unchanged.

## Switching an extension on

Every extension the database image carries is listed in the dashboard's **Extensions** tab
(dashboard.snoutdata.com, open the project, **Extensions**). The list is read from the database
itself. Switching one on runs `create extension` and takes effect at once, with no restart.

The same thing in SQL, from the SQL tab, `snoutdata db psql` or any client:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
```

Your project's owner role is not a superuser, and it does not need to be for these. The image
lets the owner create the extensions it vouches for, including PostGIS, pgvector, pg_cron,
pg_net, pg_graphql, hypopg, pgaudit and pg_repack, and grants the owner what each one creates. An
extension that is not on that list fails with Postgres's own refusal rather than doing nothing.

### Time series: SnoutTime

**SnoutTime, part of SnoutData Cloud**, is on that list on every plan: `create extension snouttime`
turns tables into series tables partitioned by time, seals old partitions into a compressed column
store, and keeps rollups current. It runs its own background worker, so it needs no pg_cron job.
It has its own section: start at [Time series with SnoutTime](./timeseries/overview.md).

## Scheduled jobs (pg_cron)

A job is a SQL statement and a schedule. It runs inside your database, as the role that scheduled
it, with nothing else to deploy.

### From the dashboard

Open the project and choose the **Cron** tab. It shows every job you have scheduled, from anywhere,
because it reads pg_cron's own tables:

- each job's schedule, its SQL, and whether it is active;
- the last run: succeeded or failed, when, and the error message when it failed;
- how many times it failed in the last day;
- **Runs**, the last 25 runs of one job with how long each took;
- a switch to pause or resume a job, and **Delete**;
- **Schedule a job**, with common schedules and three starting points (trim the run history, call a
  URL, refresh a materialized view).

If pg_cron is off, the tab offers to switch it on.

### From SQL

```sql
-- every day at 03:00 UTC; scheduling again under the same name replaces the job
select cron.schedule('nightly-cleanup', '0 3 * * *',
  $$delete from public.sessions where expires_at < now()$$);

-- every 30 seconds (intervals of 1 to 59 seconds are allowed)
select cron.schedule('heartbeat', '30 seconds', $$insert into public.beats default values$$);

-- what is scheduled, and how the runs went
select jobid, jobname, schedule, active from cron.job;
select jobid, status, start_time, return_message
from cron.job_run_details order by start_time desc limit 20;

-- pause, resume, remove
select cron.alter_job(job_id := 1, active := false);
select cron.alter_job(job_id := 1, active := true);
select cron.unschedule('nightly-cleanup');
```

Schedules are standard five-field cron, **in UTC**.

### From the CLI

The CLI has no separate cron command: jobs are SQL, and `snoutdata db psql` runs SQL against the
linked project (it needs `psql` installed).

```bash
snoutdata db psql -- -c "select cron.schedule('nightly-cleanup', '0 3 * * *', \$\$delete from public.sessions where expires_at < now()\$\$)"
snoutdata db psql -- -c "select jobid, jobname, schedule, active from cron.job"
snoutdata db psql -- -c "select cron.unschedule('nightly-cleanup')"
```

Because a job is SQL, it can also live in a migration file and arrive with `snoutdata db push`.

### What to know before relying on it

- **A paused project runs no jobs.** On a plan that pauses idle projects, a job's time that passes
  while the project is paused is skipped, not caught up after it wakes. A project that must run a
  job on time needs a plan that does not pause, or traffic that keeps it awake.
- **At most three jobs run at the same moment.** A fourth that is due waits for one to finish.
  Keep a job short, or split it.
- **A job runs as the role that scheduled it.** It can do what that role can do, and nothing it
  would be refused interactively.
- **pg_cron never deletes its run history.** `cron.job_run_details` gains a row per run for as
  long as the job exists. Schedule the trim yourself (the Cron tab's first template is this one):

  ```sql
  select cron.schedule('trim-cron-history', '0 3 * * *',
    $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$);
  ```

- **Cron jobs you schedule are yours alone.** `cron.job` and `cron.job_run_details` only show
  a role the jobs it scheduled.

## HTTP requests from SQL (pg_net)

pg_net sends HTTP requests from inside the database without waiting for the answer. The call
returns a request id straight away, a background worker makes the request, and the response
lands in `net._http_response`.

```sql
create extension if not exists pg_net;

select net.http_post(
  url     := 'https://example.com/hook',
  headers := '{"content-type": "application/json"}'::jsonb,
  body    := jsonb_build_object('event', 'signup', 'at', now())
) as request_id;

select net.http_get('https://example.com/status');

-- a moment later
select id, status_code, error_msg, left(content, 200)
from net._http_response order by id desc limit 10;
```

Responses are kept for six hours and then removed.

### Calling a URL on a schedule

The two together are a webhook on a timer, or a way to call one of your
[Snout Functions](./functions) regularly:

```sql
select cron.schedule('ping-my-function', '*/5 * * * *', $$
  select net.http_post(
    url     := 'https://<ref>.api.snoutdata.com/functions/v1/sync',
    headers := jsonb_build_object('content-type', 'application/json',
                                  'authorization', 'Bearer <service_role key>'),
    body    := '{}'::jsonb
  )
$$);
```

A key written into a job is stored in `cron.job` in plain text, readable by the role that owns
the job. Use a key you can rotate (`snoutdata keys` shows them, and a rotation is one command).

### Who can use it

When pg_net is switched on, only the project's owner role and `service_role` can call it. `anon`
and `authenticated`, the roles every request through the data API runs as, get nothing until you
decide otherwise:

```sql
grant usage on schema net to authenticated;
grant execute on function net.http_post(text, jsonb, jsonb, jsonb, integer) to authenticated;
```

Think before you do: a signed-in user who can call it can make your database send requests
anywhere on the internet.

### Where a request can go

The public internet. A request to a private address (the cloud provider's metadata service, the
network the database runs on, or any other private range) is refused at the network, whatever SQL
asks for it, and comes back in `net._http_response` with an error such as
`Couldn't connect to server`.
