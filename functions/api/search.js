import { json } from '../_utils.js'

export async function onRequestGet({ request, env }) {
  const q = new URL(request.url).searchParams.get('q')?.trim()
  if (!q || q.length < 2) return json({ notes: [], categories: [], tags: [] })

  // 使用 FTS5 全文搜索
  const { results: notes } = await env.DB.prepare(`
    SELECT n.id, n.title, n.excerpt, n.status, n.updated_at,
           c.name as category_name, c.icon as category_icon,
           snippet(notes_fts, 1, '<mark>', '</mark>', '...', 20) as highlight
    FROM notes_fts
    JOIN notes n ON notes_fts.rowid = n.rowid
    LEFT JOIN categories c ON n.category_id = c.id
    WHERE notes_fts MATCH ? AND n.status != 'archived'
    ORDER BY rank LIMIT 10
  `).bind(q + '*').all()

  const { results: categories } = await env.DB.prepare(`
    SELECT * FROM categories WHERE name LIKE ? LIMIT 5
  `).bind(`%${q}%`).all()

  const { results: tags } = await env.DB.prepare(`
    SELECT * FROM tags WHERE name LIKE ? LIMIT 5
  `).bind(`%${q}%`).all()

  return json({ notes: notes || [], categories, tags })
}
