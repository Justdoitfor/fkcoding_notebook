import { json, error, nanoid, toSlug, wordCount, updateDailyActivity } from '../../_utils.js'

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url)
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '20')
  const status = url.searchParams.get('status')
  const category = url.searchParams.get('category')
  const tag = url.searchParams.get('tag')
  const offset = (page - 1) * limit

  let query = `
    SELECT n.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
           GROUP_CONCAT(t.name) as tag_names,
           GROUP_CONCAT(t.id) as tag_ids,
           GROUP_CONCAT(t.color) as tag_colors
    FROM notes n
    LEFT JOIN categories c ON n.category_id = c.id
    LEFT JOIN notes_tags nt ON n.id = nt.note_id
    LEFT JOIN tags t ON nt.tag_id = t.id
    WHERE 1=1
  `
  const params = []

  if (status && status !== 'all') { query += ' AND n.status = ?'; params.push(status) }
  if (category) { query += ' AND n.category_id = ?'; params.push(category) }
  if (tag) {
    query += ' AND n.id IN (SELECT note_id FROM notes_tags WHERE tag_id = ?)'
    params.push(tag)
  }

  query += ' GROUP BY n.id ORDER BY n.updated_at DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)

  const { results } = await env.DB.prepare(query).bind(...params).all()

  // 获取总数
  let countQuery = 'SELECT COUNT(DISTINCT n.id) as total FROM notes n LEFT JOIN notes_tags nt ON n.id = nt.note_id WHERE 1=1'
  const countParams = []
  if (status && status !== 'all') { countQuery += ' AND n.status = ?'; countParams.push(status) }
  if (category) { countQuery += ' AND n.category_id = ?'; countParams.push(category) }
  if (tag) { countQuery += ' AND n.id IN (SELECT note_id FROM notes_tags WHERE tag_id = ?)'; countParams.push(tag) }

  const { results: [{ total }] } = await env.DB.prepare(countQuery).bind(...countParams).all()

  // 处理标签数据
  const notes = results.map(note => ({
    ...note,
    cover_image: undefined, // 列表不返回图片 base64，节省流量
    tags: note.tag_ids
      ? note.tag_ids.split(',').map((id, i) => ({
          id, name: note.tag_names.split(',')[i], color: note.tag_colors.split(',')[i]
        }))
      : []
  }))

  return json({ notes, total, page, limit, totalPages: Math.ceil(total / limit) })
}

export async function onRequestPost({ request, env }) {
  const body = await request.json()
  const { title, content = '', status = 'draft', category_id, tags = [] } = body

  if (!title?.trim()) return error('标题不能为空')

  const id = nanoid()
  const slug = toSlug(title) + '-' + nanoid(6)
  const excerpt = content.replace(/[#*\`>|\[\]]/g, '').slice(0, 200)
  const wc = wordCount(content)
  const readTime = Math.max(1, Math.ceil(wc / 300))

  await env.DB.prepare(`
    INSERT INTO notes (id, title, content, excerpt, slug, status, category_id, word_count, read_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, title.trim(), content, excerpt, slug, status, category_id || null, wc, readTime).run()

  // 关联标签
  for (const tagId of tags) {
    await env.DB.prepare('INSERT OR IGNORE INTO notes_tags (note_id, tag_id) VALUES (?, ?)')
      .bind(id, tagId).run()
  }

  // 更新每日活动
  if (status === 'published') {
    await updateDailyActivity(env.DB, { note_count: 1, word_count: wc })
  }

  const note = await env.DB.prepare('SELECT * FROM notes WHERE id = ?').bind(id).first()
  return json(note, 201)
}
