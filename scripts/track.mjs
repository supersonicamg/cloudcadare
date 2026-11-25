#!/usr/bin/env node
// Tracks which mockup screens are built. Data: plan/tracker.json.
// The default view shows only open work in the earliest unfinished phase, so finished
// screens and later phases never need to be re-read.
import { readFileSync, writeFileSync } from 'node:fs'

const FILE = new URL('../plan/tracker.json', import.meta.url)
const data = JSON.parse(readFileSync(FILE, 'utf8'))
const save = () => writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n')

const HELP = `Usage: node scripts/track.mjs [command]   (or: pnpm track [command])
  (nothing)              open screens in the current phase
  phase N                open screens in phase N (1 to 4)
  open                   open screens in every phase
  next                   details of the next open screen
  show ID                details of one screen
  done ID [ID...]        mark as built and verified
  reopen ID [ID...]      mark as open again
  note ID "text"         set a note on a screen
  all                    every screen, including finished ones`

function find(id) {
  const item = data.items.find((i) => i.id.toLowerCase() === String(id).toLowerCase())
  if (!item) {
    console.error(`No screen with id "${id}".`)
    process.exit(1)
  }
  return item
}

function details(i) {
  console.log(`${i.id}  ${i.title}  [${i.status}]`)
  console.log(`  phase   ${i.phase}`)
  console.log(`  mockup  ${i.mockup}`)
  console.log(`  route   ${i.route}`)
  console.log(`  code    ${i.code}`)
  console.log(`  kind    ${i.kind === 'new' ? 'new feature (needs data and server work; ask the owner first)' : 'restyle an existing page to the mockup'}`)
  if (i.note) console.log(`  note    ${i.note}`)
}

function list(items) {
  let group
  for (const i of items) {
    if (i.group !== group) console.log(`\n${(group = i.group)}`)
    const mark = i.status === 'done' ? 'x' : ' '
    console.log(`  [${mark}] ${i.id.padEnd(4)} ${i.title.padEnd(48)} ${i.route}`)
  }
}

const summary = () => {
  const done = data.items.filter((i) => i.status === 'done').length
  console.log(`Open: ${data.items.length - done} of ${data.items.length} screens (${done} done)`)
}

const [command, ...args] = process.argv.slice(2)
const open = data.items.filter((i) => i.status !== 'done') // the file is ordered by phase
const current = open[0]?.phase

function listPhase(phase) {
  const items = open.filter((i) => i.phase === phase)
  console.log(`\nPhase ${phase}: ${items.length} open`)
  list(items)
}

if (!command) {
  summary()
  if (open.length) {
    listPhase(current)
    const later = open.filter((i) => i.phase !== current).length
    if (later) console.log(`\n${later} more in later phases (node scripts/track.mjs open).`)
    console.log('Start with: node scripts/track.mjs next')
  }
} else if (command === 'phase' && /^[1-4]$/.test(args[0] ?? '')) {
  summary()
  listPhase(args[0])
} else if (command === 'open') {
  summary()
  list(open)
} else if (command === 'next') {
  if (open.length) details(open[0])
  else console.log('Nothing open. Every screen is built.')
} else if (command === 'show' && args.length === 1) {
  details(find(args[0]))
} else if ((command === 'done' || command === 'reopen') && args.length) {
  const items = args.map(find) // every id is checked before anything is written
  for (const i of items) i.status = command === 'done' ? 'done' : 'todo'
  save()
  console.log(`${command === 'done' ? 'Done' : 'Reopened'}: ${items.map((i) => i.id).join(', ')}`)
  summary()
} else if (command === 'note' && args.length === 2) {
  find(args[0]).note = args[1]
  save()
  console.log(`Note saved on ${find(args[0]).id}.`)
} else if (command === 'all') {
  summary()
  list(data.items)
} else {
  console.log(HELP)
  if (command !== 'help') process.exit(1)
}
