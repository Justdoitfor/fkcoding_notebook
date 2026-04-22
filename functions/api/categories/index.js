import { json } from '../../_utils.js'

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare('SELECT * FROM categories ORDER BY sort_order, created_at DESC').all()
  return json(results)
}
