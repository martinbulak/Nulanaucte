import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth.js'
import { rateLimit } from '../middleware/rateLimit.js'
import {
  addCategoryToRegistry,
  listCategoryRegistry,
  listUserCategories,
  setCategoryArchived,
} from '../db.js'
import { PRIJEM_STARTERS, VYDAVOK_STARTERS } from '../lib/ai.js'

/**
 * Separate category "číselník" per transaction type:
 *
 *   GET  /api/categories?type=vydavok|prijem
 *        Returns the merged + de-duped list used by the dropdown UI in
 *        /vydavky and /prijmy. Merges in this priority order:
 *          1. User's curated registry (active rows from category_registry)
 *          2. Categories actually used on transactions of this type
 *             (sorted by frequency in listUserCategories)
 *          3. Starter list for that type (system defaults)
 *        Archived registry rows are excluded.
 *
 *   POST /api/categories  { name, type }
 *        Add (or reactivate, if previously archived) a custom category.
 *
 *   PATCH /api/categories/:id  { archived: boolean }
 *        Soft-delete / restore — historical transactions keep their label.
 *
 *   GET  /api/categories/all?type=...
 *        Settings UI: returns registry rows directly, including archived,
 *        so the user can toggle archive state. Includes a `source` field
 *        so the UI can label starter vs. user-added rows.
 */
export const categoriesRoutes = new Hono()

categoriesRoutes.use('*', requireAuth)

const editLimit = rateLimit({
  name: 'categories-edit',
  max: 60,
  windowMs: 60 * 60 * 1000,
  keyer: (c) => `u:${c.get('user').id}`,
})

function parseType(raw: string | undefined): 'vydavok' | 'prijem' | null {
  return raw === 'vydavok' || raw === 'prijem' ? raw : null
}

function startersFor(type: 'vydavok' | 'prijem'): readonly string[] {
  return type === 'vydavok' ? VYDAVOK_STARTERS : PRIJEM_STARTERS
}

/** De-duped, case-insensitive merge of N name arrays preserving first occurrence. */
function mergeUnique(...arrays: ReadonlyArray<readonly string[]>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const arr of arrays) {
    for (const name of arr) {
      const k = name.trim().toLowerCase()
      if (!k || seen.has(k)) continue
      seen.add(k)
      out.push(name.trim())
    }
  }
  return out
}

categoriesRoutes.get('/', async (c) => {
  const user = c.get('user')
  const type = parseType(c.req.query('type'))
  if (!type) return c.json({ ok: false, error: 'type=vydavok|prijem required' }, 400)

  const [registry, usedOnTxs] = await Promise.all([
    listCategoryRegistry(user.id, type),
    listUserCategories(user.id, type),
  ])

  const activeRegistryNames = registry.filter((r) => !r.archived).map((r) => r.name)
  const archivedNames = new Set(
    registry.filter((r) => r.archived).map((r) => r.name.toLowerCase()),
  )
  const starters = startersFor(type).filter(
    (s) => !archivedNames.has(s.toLowerCase()),
  )

  const merged = mergeUnique(activeRegistryNames, usedOnTxs, starters)

  return c.json({
    ok: true,
    data: {
      type,
      categories: merged,
      registry, // raw rows — used by Settings to render the management UI
      starters: startersFor(type),
    },
  })
})

categoriesRoutes.post('/', editLimit, async (c) => {
  const user = c.get('user')
  let body: { name?: unknown; type?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'Neplatný formát požiadavky' }, 400)
  }
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const type = parseType(typeof body.type === 'string' ? body.type : undefined)
  if (!type) return c.json({ ok: false, error: 'type=vydavok|prijem required' }, 400)
  if (name.length < 2) return c.json({ ok: false, error: 'Min 2 znaky' }, 400)
  if (name.length > 60) return c.json({ ok: false, error: 'Max 60 znakov' }, 400)

  const created = await addCategoryToRegistry({ userId: user.id, name, type })
  if (!created) return c.json({ ok: false, error: 'Nepodarilo sa pridať' }, 400)
  return c.json({ ok: true, data: created })
})

categoriesRoutes.patch('/:id', editLimit, async (c) => {
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ ok: false, error: 'Neplatné id' }, 400)
  let body: { archived?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'Neplatný formát požiadavky' }, 400)
  }
  if (typeof body.archived !== 'boolean') {
    return c.json({ ok: false, error: 'archived musí byť boolean' }, 400)
  }
  const updated = await setCategoryArchived(user.id, id, body.archived)
  if (!updated) return c.json({ ok: false, error: 'Nenájdené' }, 404)
  return c.json({ ok: true, data: updated })
})
