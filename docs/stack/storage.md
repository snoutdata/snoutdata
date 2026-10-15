---
id: storage
title: File storage
sidebar_label: File storage
---

# File storage

`https://<ref>.api.snoutdata.com/v1/files` keeps your users' files in spaces, governed by
policies you write as SQL, with signed links for handing out a private file temporarily. It is on
every plan, and it is a switch you throw:

```bash
snoutdata products enable storage
```

Or press **Turn on storage** on the project's Storage tab in the dashboard.

## Spaces and files

```js
import { snout } from '@snoutdata/client'
const db = snout('https://<ref>.api.snoutdata.com', '<your app key>')

await db.files.space('documents').put('invoices/7.pdf', file)
const { data } = await db.files.space('documents').get('invoices/7.pdf')

// A private file, lent out for ten minutes.
const { data: link } = await db.files
  .space('documents')
  .signedLink('invoices/7.pdf', 600)
```

A space is either public (anyone with the URL) or private (a policy decides, and a signed link is
how you make an exception). Create them from the client, from the dashboard, or in SQL.

A signed **upload** URL works the same way in the other direction: `createSignedUploadUrl` gives a
URL that takes one `PUT` of the file with no key and no session, so a server can hand it to a
browser or a device and let it upload that one file.

**Resumable uploads** use the tus protocol at `/v1/files/upload/resume`, with the
metadata (`bucketName`, `objectName`, `contentType`) any tus client such as `tus-js-client` already
sends, so a large file on a poor connection picks up from the last chunk that arrived instead of
starting again.

## Access is decided the same way your rows are

There is no second permissions system to learn. A file's metadata is a row in `snout_files.files`,
and you write ordinary policies against it:

```sql
create policy "a user reads their own folder"
  on snout_files.files for select
  using (
    bucket_id = 'documents'
    and (snout_files.foldername(name))[1] = snout_identity.user_id()::text
  );
```

So the token your [auth service](/stack/auth) issued decides what a request can read, exactly as it does
for a table.

:::note
**Writing your own storage policies did not work until 2026-09-11.** The project owner had no
rights on the `snout_files` schema, so `create policy on snout_files.files` — the commonest statement in
any application that stores files — failed outright. It is fixed, and a signed-in user uploading
under their own policy is one of the checks we run against a live project now. It is written down
because a customer who tried it in the first week deserves to know it was us.
:::

## Images, resized on the way out

`/v1/files/image` serves a transformed version of an image, so you can ask for the size you
need instead of shipping the original to a phone:

```js
const { data } = db.files.space('avatars').publicLink('ada.png', {
  transform: { width: 128, height: 128, resize: 'cover' }
})
```

## What each plan gets

| | Free | Plus | Pro |
| --- | --- | --- | --- |
| Files, in total | 500 MB | 8 GB | 20 GB |
| One upload, at most | 50 MB | 500 MB | 5 GB |

Files have their own allowance, the same size as the database's storage row: a project on Plus may
hold 8 GB of data **and** 8 GB of files. The files total is measured every fifteen minutes, and a
project over either one is made read-only until it is back under, the same as for its database.

## Where the bytes actually go

Into object storage we operate, under **your project's own prefix**, which is the same place your
backups live and is fenced the same way: a project is handed credentials scoped to its own prefix,
minted an hour at a time, so nothing running inside one project can reach another's files.

Uploads and downloads pass through the storage service on their way to and from the object store,
**streamed**: a file is never held whole in memory, so a 1 GB upload costs the machine a few
buffers rather than a gigabyte, and a large upload is not slower for everybody else on it. A
signed link is a URL on your project's own address, and the token in it is the credential.

The storage service itself is one of the three that run **shared per machine** rather than inside
your project's container. [Security](/cloud/security) says what that means for the tenant
boundary, in the same words we would use to a reviewer.

## Not built

- **A per-space transfer or bandwidth quota.** The plan's total size is the only cap.
- **Your own object store.** Files go to ours.

## Also read

- [Authentication](/stack/auth), which issues the tokens these policies read.
- [Limits, and what is not built](/cloud/limits), for the plan table.
- [Security](/cloud/security), for isolation and what we hold.
