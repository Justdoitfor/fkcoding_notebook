// 统一响应格式
export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

export const error = (msg, status = 400) =>
  json({ error: msg }, status)

// 生成 nanoid（不依赖 Node.js）
export const nanoid = (size = 12) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from(crypto.getRandomValues(new Uint8Array(size)))
    .map(n => chars[n % chars.length]).join('')
}

// 生成 slug（支持中文转拼音降级为 id）
export const toSlug = (text) => {
  return text.toLowerCase()
    .replace(/[\s\u4e00-\u9fa5]+/g, '-')  // 中文和空格转连字符
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-').replace(/^-|-$/g, '')
    || nanoid(8)
}

// 计算字数（中英文混合）
export const wordCount = (text) => {
  const cn = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const en = (text.match(/[a-zA-Z]+/g) || []).length
  return cn + en
}

// 更新每日活动记录
export const updateDailyActivity = async (DB, delta = { note_count: 0, word_count: 0 }) => {
  const today = new Date().toISOString().slice(0, 10)
  await DB.prepare(`
    INSERT INTO daily_activity (date, note_count, word_count)
    VALUES (?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      note_count = note_count + excluded.note_count,
      word_count = word_count + excluded.word_count
  `).bind(today, delta.note_count, delta.word_count).run()
}
