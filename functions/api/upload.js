import { json, error, nanoid } from '../_utils.js'

export async function onRequestPost({ request, env }) {
  const { filename, mime_type, data, note_id } = await request.json()

  // 限制：仅图片，base64 大小不超过 2MB（约 1.5MB 原始文件）
  if (!mime_type?.startsWith('image/')) return error('仅支持图片格式')
  const sizeBytes = Math.ceil((data.length * 3) / 4)
  if (sizeBytes > 2 * 1024 * 1024) return error('图片不能超过 2MB')

  const id = nanoid()
  await env.DB.prepare(`
    INSERT INTO attachments (id, note_id, filename, mime_type, data, size)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(id, note_id || null, filename, mime_type, data, sizeBytes).run()

  // 返回可直接嵌入 markdown 的 data URL
  return json({ id, url: data, filename })
}
