// Insert, query and update rows in a SnoutData Cloud project with @snoutdata/client.
//
// Server-side only: the server key bypasses row-level security, so it must never be
// shipped to a browser. For a browser, see ../web-notes, which uses the app key.
import { snout } from '@snoutdata/client'

const url = process.env.SNOUTDATA_URL
const key = process.env.SNOUTDATA_SERVER_KEY
if (!url || !key) {
	console.error('Set SNOUTDATA_URL and SNOUTDATA_SERVER_KEY in .env (see README.md).')
	process.exit(1)
}

const db = snout(url, key)

function check(error, what) {
	if (error) {
		console.error(`${what} failed:`, error.message)
		process.exit(1)
	}
}

// Insert three rows and get them back.
const { data: inserted, error: insertError } = await db
	.table('todos')
	.add([{ note: 'Create a project' }, { note: 'Push a migration' }, { note: 'Query it from Node' }])
	.read('id, note')
check(insertError, 'insert')
console.log('inserted:', inserted)

// Mark the first one done.
const { error: updateError } = await db.table('todos').change({ done: true }).eq('id', inserted[0].id)
check(updateError, 'update')

// Everything still to do, oldest first.
const { data: open, error: selectError } = await db
	.table('todos')
	.read('id, note, done')
	.eq('done', false)
	.order('id', { ascending: true })
check(selectError, 'read')
console.log('still to do:', open)
