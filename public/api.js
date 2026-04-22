const api = {
  async request(path, options = {}) {
    const res = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || \`HTTP \${res.status}\`)
    }
    return res.json()
  },
  get(path, params = {}) {
    const url = new URL(path, window.location.origin)
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.append(k, v)
    })
    return this.request(url.pathname + url.search)
  },
  post(path, body) {
    return this.request(path, { method: 'POST', body: JSON.stringify(body) })
  },
  patch(path, body) {
    return this.request(path, { method: 'PATCH', body: JSON.stringify(body) })
  },
  delete(path) {
    return this.request(path, { method: 'DELETE' })
  }
}

export const notesApi = {
  list: (params) => api.get('/api/notes', params),
  get: (id) => api.get(\`/api/notes/\${id}\`),
  create: (data) => api.post('/api/notes', data),
  update: (id, data) => api.patch(\`/api/notes/\${id}\`, data),
  remove: (id) => api.delete(\`/api/notes/\${id}\`)
}

export const statsApi = {
  get: () => api.get('/api/stats')
}

export const searchApi = {
  query: (q) => api.get('/api/search', { q })
}

export const categoriesApi = {
  list: () => api.get('/api/categories')
}

export const tagsApi = {
  list: () => api.get('/api/tags')
}

export const uploadApi = {
  upload: (data) => api.post('/api/upload', data)
}
