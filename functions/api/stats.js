import { json } from '../_utils.js'

export async function onRequestGet({ env }) {
  const [noteCount, catCount, tagCount, wordSum, activity] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) as c FROM notes WHERE status != 'archived'").first(),
    env.DB.prepare('SELECT COUNT(*) as c FROM categories').first(),
    env.DB.prepare('SELECT COUNT(*) as c FROM tags').first(),
    env.DB.prepare("SELECT SUM(word_count) as s FROM notes WHERE status != 'archived'").first(),
    env.DB.prepare(`
      SELECT date, note_count FROM daily_activity
      WHERE date >= date('now', '-180 days')
      ORDER BY date
    `).all()
  ])

  return json({
    note_count: noteCount.c,
    category_count: catCount.c,
    tag_count: tagCount.c,
    total_words: wordSum.s || 0,
    activity: activity.results
  })
}
