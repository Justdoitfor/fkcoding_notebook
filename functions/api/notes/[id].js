import { json, error, wordCount, toSlug, updateDailyActivity } from '../../_utils.js'

export async function onRequestGet({ params, env }) {
  const note = await env.DB.prepare(`
    SELECT n.*, c.name as category_name, c.icon as category_icon, c.color as category_color
    FROM notes n LEFT JOIN categories c ON n.category_id = c.id
    WHERE n.id = ?
  `).bind(params.id).first()

  if (!note) return error('笔记不存在', 404)

  const { results: tags } = await env.DB.prepare(`
    SELECT t.* FROM tags t JOIN notes_tags nt ON t.id = nt.tag_id WHERE nt.note_id = ?
  `).bind(params.id).all()

  return json({ ...note, tags })
}

export async function onRequestPatch({ request, params, env }) {
  const body = await request.json()
  const { title, content, status, category_id, tags } = body

  const existing = await env.DB.prepare('SELECT * FROM notes WHERE id = ?').bind(params.id).first()
  if (!existing) return error('笔记不存在', 404)

  const updates = {}
  if (title !== undefined) updates.title = title.trim()
  if (content !== undefined) {
    updates.content = content
    updates.excerpt = content.replace(/[#*\`>|\[\]]/g, '').slice(0, 200)
    updates.word_count = wordCount(content)
    updates.read_time = Math.max(1, Math.ceil(updates.word_count / 300))
  }
  if (status !== undefined) updates.status = status
  if (category_id !== undefined) updates.category_id = category_id
  updates.updated_at = new Date().toISOString()

  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ')
  if (setClauses.length > 0) {
    await env.DB.prepare(`UPDATE notes SET ${setClauses} WHERE id = ?`)
      .bind(...Object.values(updates), params.id).run()
  }

  // 更新标签
  if (Array.isArray(tags)) {
    await env.DB.prepare('DELETE FROM notes_tags WHERE note_id = ?').bind(params.id).run()
    for (const tagId of tags) {
      await env.DB.prepare('INSERT OR IGNORE INTO notes_tags (note_id, tag_id) VALUES (?, ?)')
        .bind(params.id, tagId).run()
    }
  }

  const updated = await env.DB.prepare('SELECT * FROM notes WHERE id = ?').bind(params.id).first()
  return json(updated)
}

export async function onRequestDelete({ params, env }) {
  const existing = await env.DB.prepare('SELECT id FROM notes WHERE id = ?').bind(params.id).first()
  if (!existing) return error('笔记不存在', 404)

  await env.DB.prepare("UPDATE notes SET status = 'archived', updated_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), params.id).run()

  return json({ success: true })
}
