import { json } from '../../_utils.js'

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare('SELECT * FROM tags ORDER BY name').all()
  return json(results)
}
