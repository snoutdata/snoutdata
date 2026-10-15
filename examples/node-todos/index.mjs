// Insert, query and update rows in a SnoutData Cloud project with @snoutdata/client.
//
// Server-side only: the service_role key bypasses row-level security, so it must never be
// shipped to a browser. For a browser, see ../web-notes, which uses the anon key.
import { createClient } from '@snoutdata/client'

const url = process.env.SNOUTDATA_URL
const key = process.env.SNOUTDATA_SERVICE_ROLE_KEY
if (!url || !key) {
	console.error('Set SNOUTDATA_URL and SNOUTDATA_SERVICE_ROLE_KEY in .env (see README.md).')
	process.exit(1)
}

const db = createClient(url, key)

function check(error, what) {
	if (error) {
		console.error(`${what} failed:`, error.message)
		process.exit(1)
	}
}

// Insert three rows and get them back.
const { data: inserted, error: insertError } = await db
	.from('todos')
	.insert([{ note: 'Create a project' }, { note: 'Push a migration' }, { note: 'Query it from Node' }])
	.select('id, note')
check(insertError, 'insert')
console.log('inserted:', inserted)

// Mark the first one done.
const { error: updateError } = await db.from('todos').update({ done: true }).eq('id', inserted[0].id)
check(updateError, 'update')

// Everything still to do, oldest first.
const { data: open, error: selectError } = await db
	.from('todos')
	.select('id, note, done')
	.eq('done', false)
	.order('id', { ascending: true })
check(selectError, 'select')
console.log('still to do:', open)
