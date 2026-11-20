/**
 * Seeds reference data and demo users. Safe to run repeatedly (upserts by id).
 * Demo users all get the password in SEED_PASSWORD. This is for development and demos only:
 * change every password (or replace these users) before real use.
 */
import 'dotenv/config'
import { createDb } from '../src/db/client'
import { hashPassword, passwordProblem } from '../src/lib/password'

const LINES = [
  { id: 'line-cut-01', name: 'Cutting Line 01', code: 'CUT' },
  { id: 'line-bend-01', name: 'Bending Line 01', code: 'BND' },
  { id: 'line-weld-01', name: 'Welding Line 01', code: 'WLD' },
]
const PRODUCTS = [
  { id: 'prod-bracket', name: 'Steel mounting brackets' },
  { id: 'prod-frame', name: 'Fabricated steel frames' },
  { id: 'prod-panel', name: 'Metal panels' },
  { id: 'prod-custom', name: 'Custom metal components' },
]
const MACHINES = [
  { id: 'mc-lc-01', name: 'Laser Cutter LC-01', lineId: 'line-cut-01', shiftTarget: 250 },
  { id: 'mc-sh-02', name: 'Shear SH-02', lineId: 'line-cut-01', shiftTarget: 250 },
  { id: 'mc-pb-01', name: 'Press Brake PB-01', lineId: 'line-bend-01', shiftTarget: 220 },
  { id: 'mc-pb-02', name: 'Press Brake PB-02', lineId: 'line-bend-01', shiftTarget: 220 },
  { id: 'mc-wc-01', name: 'Welding Cell WC-01', lineId: 'line-weld-01', shiftTarget: 180 },
  { id: 'mc-wc-02', name: 'Welding Cell WC-02', lineId: 'line-weld-01', shiftTarget: 180 },
]
const DEFECTS = [
  { id: 'defect-dimensional', name: 'Dimensional deviation' },
  { id: 'defect-surface', name: 'Surface scratch or dent' },
  { id: 'defect-burr', name: 'Burr or rough edge' },
  { id: 'defect-bend', name: 'Bend angle out of tolerance' },
  { id: 'defect-weld', name: 'Weld defect' },
  { id: 'defect-other', name: 'Other' },
]
const SHIFTS = [
  { id: 'morning', name: 'Morning', startTime: '06:00', endTime: '18:00' },
  { id: 'night', name: 'Night', startTime: '18:00', endTime: '06:00' },
]
const OPERATIONS = [
  { id: 'op-cutting', name: 'Cutting', sortOrder: 1 },
  { id: 'op-bending', name: 'Bending', sortOrder: 2 },
  { id: 'op-welding', name: 'Welding', sortOrder: 3 },
  { id: 'op-inspection', name: 'Inspection', sortOrder: 4 },
]
const USERS = [
  { id: 'user-admin', name: 'Carlo Reyes', email: 'carlo.reyes@northstar.example', role: 'administrator' },
  { id: 'user-mgr', name: 'Mira Santos', email: 'mira.santos@northstar.example', role: 'manager' },
  { id: 'user-sup-1', name: 'Rosa Villanueva', email: 'rosa.villanueva@northstar.example', role: 'supervisor' },
  { id: 'user-sup-2', name: 'Benjie Ramos', email: 'benjie.ramos@northstar.example', role: 'supervisor' },
  { id: 'user-op-1', name: 'Juan Dela Cruz', email: 'juan.delacruz@northstar.example', role: 'operator' },
  { id: 'user-op-2', name: 'Mark Bautista', email: 'mark.bautista@northstar.example', role: 'operator' },
  { id: 'user-op-3', name: 'Maria Reyes', email: 'maria.reyes@northstar.example', role: 'operator' },
  { id: 'user-op-4', name: 'Carlo Mendoza', email: 'carlo.mendoza@northstar.example', role: 'operator' },
  { id: 'user-op-5', name: 'Jose Ramos', email: 'jose.ramos@northstar.example', role: 'operator' },
] as const

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL
  const password = process.env.SEED_PASSWORD
  if (!url) throw new Error('DATABASE_URL is not set.')
  if (!password) throw new Error('SEED_PASSWORD is not set. Choose a password for the demo users (at least 10 characters).')
  const problem = passwordProblem(password)
  if (problem) throw new Error(`SEED_PASSWORD is not acceptable: ${problem}`)

  const db = createDb(url)
  try {
    for (const l of LINES) await db.productionLine.upsert({ where: { id: l.id }, update: {}, create: l })
    for (const p of PRODUCTS) await db.product.upsert({ where: { id: p.id }, update: {}, create: p })
    for (const m of MACHINES) await db.machine.upsert({ where: { id: m.id }, update: {}, create: m })
    for (const d of DEFECTS) await db.defectType.upsert({ where: { id: d.id }, update: {}, create: d })
    for (const s of SHIFTS) await db.shift.upsert({ where: { id: s.id }, update: {}, create: s })
    for (const o of OPERATIONS) await db.operation.upsert({ where: { id: o.id }, update: {}, create: o })
    for (const u of USERS) {
      // Existing users keep their current password: re-seeding must never reset a password someone changed.
      const existing = await db.user.findUnique({ where: { id: u.id }, select: { id: true } })
      if (!existing) await db.user.create({ data: { ...u, passwordHash: await hashPassword(password) } })
    }
    console.log(`Seeded ${LINES.length} lines, ${MACHINES.length} machines, ${PRODUCTS.length} products, ${DEFECTS.length} defect types, ${USERS.length} users.`)
  } finally {
    await db.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
