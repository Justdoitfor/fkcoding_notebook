# fkcoding-note · 开发说明文档

> 架构：单体 HTML + Cloudflare Pages Functions + D1 数据库
> 部署：Cloudflare Pages 控制台手动部署（连接 GitHub 仓库，自动构建）

---

## 一、架构说明

### 整体架构

```
fkcoding-note/
├── public/                   # 静态资源
│   ├── index.html            # 主应用入口（SPA）
│   ├── style.css             # 全局样式
│   └── app.js                # 前端逻辑（原生 JS 或轻量框架）
├── functions/                # Cloudflare Pages Functions（后端 API）
│   └── api/
│       ├── notes/
│       │   ├── index.js      # GET /api/notes, POST /api/notes
│       │   └── [id].js       # GET/PATCH/DELETE /api/notes/:id
│       ├── categories/
│       │   ├── index.js
│       │   └── [id].js
│       ├── tags/
│       │   ├── index.js
│       │   └── [id].js
│       ├── search.js         # GET /api/search
│       ├── stats.js          # GET /api/stats
│       └── upload.js         # POST /api/upload（base64，不用 R2）
├── migrations/               # D1 数据库迁移
│   └── 0001_init.sql
├── wrangler.toml             # Cloudflare 配置
└── package.json
```

### 架构要点

- **无前后端分离**：前端是纯 HTML/CSS/JS 的 SPA，后端是 Cloudflare Pages Functions（托管在同一个 Pages 项目里）
- **无对象存储**：图片上传转为 base64 存入 D1 数据库的 `content` 字段，或存为独立的 `attachments` 表
- **无构建步骤**：前端无需 Webpack/Vite，直接写原生 JS（或用 CDN 引入 marked.js、highlight.js 等）
- **数据库**：Cloudflare D1（SQLite），通过 `env.DB` 在 Functions 中访问
- **部署**：Cloudflare Pages 控制台 → 连接 GitHub → 自动部署，无需 CI/CD 脚本

---

## 二、技术选型

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | 原生 HTML/CSS/JS | 无构建依赖，CDN 引入库 |
| Markdown 渲染 | marked.js（CDN） | 轻量，支持 GFM |
| 代码高亮 | highlight.js（CDN） | 支持 150+ 语言 |
| 数学公式 | KaTeX（CDN） | 轻量，快速 |
| 图表 | Mermaid（CDN） | 流程图/时序图 |
| 编辑器增强 | CodeMirror 6（CDN） | Markdown 语法高亮编辑器 |
| 后端运行时 | Cloudflare Pages Functions | Edge 运行，D1 绑定 |
| 数据库 | Cloudflare D1（SQLite） | 关系型，支持全文搜索 |
| 图片存储 | base64 → D1 | 避免 R2，小图片直接存库 |
| 路由 | History API（前端） | 单页应用路由 |

---

## 三、数据库 Schema

**文件：`migrations/0001_init.sql`**

```sql
-- 教程系列/分类
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '📁',
  color TEXT DEFAULT '#E8500A',
  sort_order INTEGER DEFAULT 0,
  parent_id TEXT REFERENCES categories(id),
  note_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 笔记主表
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  excerpt TEXT,
  slug TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
  category_id TEXT REFERENCES categories(id),
  word_count INTEGER DEFAULT 0,
  read_time INTEGER DEFAULT 1,
  is_featured INTEGER DEFAULT 0,
  cover_image TEXT,       -- base64 Data URL 或 null
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 标签
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  color TEXT DEFAULT '#2563EB'
);

-- 笔记-标签关联
CREATE TABLE IF NOT EXISTS notes_tags (
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

-- 每日创作记录（热力图数据源）
CREATE TABLE IF NOT EXISTS daily_activity (
  date TEXT PRIMARY KEY,   -- YYYY-MM-DD
  note_count INTEGER DEFAULT 0,
  word_count INTEGER DEFAULT 0
);

-- 附件（base64 图片，替代 R2）
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  note_id TEXT REFERENCES notes(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  data TEXT NOT NULL,      -- base64 Data URL
  size INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 全文搜索虚拟表
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  title, content, excerpt,
  content='notes',
  content_rowid='rowid'
);

-- 触发器：同步全文搜索索引
CREATE TRIGGER IF NOT EXISTS notes_fts_insert AFTER INSERT ON notes BEGIN
  INSERT INTO notes_fts(rowid, title, content, excerpt)
  VALUES (new.rowid, new.title, new.content, new.excerpt);
END;

CREATE TRIGGER IF NOT EXISTS notes_fts_update AFTER UPDATE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, content, excerpt)
  VALUES ('delete', old.rowid, old.title, old.content, old.excerpt);
  INSERT INTO notes_fts(rowid, title, content, excerpt)
  VALUES (new.rowid, new.title, new.content, new.excerpt);
END;

CREATE TRIGGER IF NOT EXISTS notes_fts_delete AFTER DELETE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, content, excerpt)
  VALUES ('delete', old.rowid, old.title, old.content, old.excerpt);
END;

-- 索引
CREATE INDEX IF NOT EXISTS idx_notes_status ON notes(status);
CREATE INDEX IF NOT EXISTS idx_notes_category ON notes(category_id);
CREATE INDEX IF NOT EXISTS idx_notes_slug ON notes(slug);
CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC);
```

---

## 四、Cloudflare 配置

**文件：`wrangler.toml`**

```toml
name = "fkcoding-note"
compatibility_date = "2024-09-23"
pages_build_output_dir = "public"

[[d1_databases]]
binding = "DB"
database_name = "fkcoding-note-db"
database_id = "PLACEHOLDER_填写创建D1后的ID"
```

**文件：`package.json`**

```json
{
  "name": "fkcoding-note",
  "version": "1.0.0",
  "scripts": {
    "dev": "wrangler pages dev public --d1=DB",
    "db:init:local": "wrangler d1 execute fkcoding-note-db --local --file=./migrations/0001_init.sql",
    "db:init:prod": "wrangler d1 execute fkcoding-note-db --remote --file=./migrations/0001_init.sql",
    "db:seed:local": "wrangler d1 execute fkcoding-note-db --local --file=./migrations/0002_seed.sql"
  }
}
```

---

## 五、Pages Functions API 实现规范

### 通用工具函数（`functions/_utils.js`）

```javascript
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
```

### API 路由规范

**`functions/api/notes/index.js`**

```javascript
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

  if (status) { query += ' AND n.status = ?'; params.push(status) }
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
  if (status) { countQuery += ' AND n.status = ?'; countParams.push(status) }
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
  const excerpt = content.replace(/[#*`>|\[\]]/g, '').slice(0, 200)
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
```

**`functions/api/notes/[id].js`**（GET/PATCH/DELETE 单篇）

```javascript
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
    updates.excerpt = content.replace(/[#*`>|\[\]]/g, '').slice(0, 200)
    updates.word_count = wordCount(content)
    updates.read_time = Math.max(1, Math.ceil(updates.word_count / 300))
  }
  if (status !== undefined) updates.status = status
  if (category_id !== undefined) updates.category_id = category_id
  updates.updated_at = new Date().toISOString()

  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ')
  await env.DB.prepare(`UPDATE notes SET ${setClauses} WHERE id = ?`)
    .bind(...Object.values(updates), params.id).run()

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
```

**`functions/api/search.js`**

```javascript
import { json } from './_utils.js'

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
```

**`functions/api/stats.js`**

```javascript
import { json } from './_utils.js'

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
```

**`functions/api/upload.js`**（base64 图片存储，不用 R2）

```javascript
import { json, error, nanoid } from './_utils.js'

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
```

---

## 六、前端实现规范

### HTML 入口（`public/index.html`）

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>fkcoding-note</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <!-- CDN 依赖（无构建步骤） -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css">
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <div id="app"><!-- 前端路由渲染 --></div>

  <!-- CDN 脚本（按需加载，不阻塞首屏） -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.6/marked.min.js" defer></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js" defer></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js" defer></script>
  <script type="module" src="/app.js"></script>
</body>
</html>
```

### 前端模块划分（`public/app.js`）

**模块一：路由（Router）**
```javascript
// 基于 History API 的轻量路由
class Router {
  routes = {}
  // 注册路由：router.on('/notes/:id', handler)
  // 导航：router.navigate('/notes/abc')
  // 路由匹配解析动态参数
}
```

**模块二：API 客户端（api.js）**
```javascript
// 统一封装 fetch，自动处理 JSON、错误
const api = {
  async get(path, params = {}) {},
  async post(path, body) {},
  async patch(path, body) {},
  async delete(path) {},
}
// 对应每个 API endpoint 的方法
export const notesApi = { list, get, create, update, remove }
export const statsApi = { get }
export const searchApi = { query }
```

**模块三：状态管理（store.js）**
```javascript
// 轻量响应式 store，不依赖框架
class Store {
  #state = {}
  #listeners = {}
  setState(key, value) { this.#state[key] = value; this.#emit(key) }
  getState(key) { return this.#state[key] }
  subscribe(key, fn) { /* 订阅变更 */ }
}
export const store = new Store()
```

**模块四：视图（views/）**
- `views/dashboard.js` — 仪表盘页面渲染
- `views/editor.js` — Markdown 编辑器页面
- `views/explore.js` — 笔记列表/探索页面

**模块五：组件（components/）**
- `components/sidebar.js` — 侧边栏
- `components/heatmap.js` — 热力图组件（纯 Canvas/SVG）
- `components/command-palette.js` — 全局搜索
- `components/md-editor.js` — Markdown 编辑器核心

### 前端设计规范（CSS 变量）

```css
:root {
  --bg: #F7F6F2;
  --surface: #FFFFFF;
  --surface-2: #F0EEE8;
  --border: #E5E2D9;
  --border-strong: #D0CCBF;
  --text-primary: #1A1916;
  --text-secondary: #6B6760;
  --text-muted: #9E9A93;
  --accent: #E8500A;
  --accent-light: #FFF0EA;
  --accent-2: #2563EB;
  --green: #16A34A;
  --amber: #D97706;
  --purple: #7C3AED;
  --radius: 10px;
  --radius-sm: 6px;
  --font-sans: 'Sora', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
  --shadow: 0 4px 12px rgba(0,0,0,0.08);
}
```

### Markdown 编辑器实现要点

编辑器使用 `<textarea>` + 实时预览方案（不依赖 CodeMirror，减少复杂度）：

```javascript
// 核心编辑器逻辑
class MarkdownEditor {
  constructor(container) {
    this.textarea = container.querySelector('#editor-input')
    this.preview = container.querySelector('#editor-preview')
    this.setupMarked()
    this.setupAutoSave()
    this.setupToolbar()
    this.bindInput()
  }

  setupMarked() {
    marked.setOptions({
      highlight: (code, lang) => hljs.highlightAuto(code, [lang]).value,
      gfm: true, breaks: true
    })
  }

  render() {
    this.preview.innerHTML = marked.parse(this.textarea.value)
    // 处理 Callout：> [!NOTE] 等
    this.renderCallouts()
    // 触发 KaTeX 数学公式渲染
    renderMathInElement(this.preview, { throwOnError: false })
  }

  setupAutoSave() {
    let timer
    this.textarea.addEventListener('input', () => {
      clearTimeout(timer)
      this.setStatus('saving')
      timer = setTimeout(() => this.save(), 2000)
      this.render()
    })
  }

  // 工具栏：插入 Markdown 语法到光标位置
  insertAt(before, after = '') {
    const start = this.textarea.selectionStart
    const end = this.textarea.selectionEnd
    const selected = this.textarea.value.slice(start, end)
    const replacement = before + selected + after
    this.textarea.setRangeText(replacement, start, end, 'select')
    this.textarea.focus()
    this.render()
  }
}
```

### 图片上传（无 R2，base64 方案）

```javascript
async function uploadImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('仅支持图片')
  if (file.size > 2 * 1024 * 1024) throw new Error('图片不能超过 2MB')

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async () => {
      const res = await api.post('/api/upload', {
        filename: file.name,
        mime_type: file.type,
        data: reader.result,  // base64 Data URL
        note_id: currentNoteId
      })
      resolve(res.url)  // 返回 base64 Data URL 可直接用于 markdown img
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
```

---

## 七、Cloudflare Pages 手动部署步骤

### 前置准备

1. 注册 [Cloudflare 账号](https://dash.cloudflare.com)
2. 将项目代码推送到 GitHub 仓库

### 步骤一：创建 D1 数据库

1. 登录 Cloudflare 控制台 → 左侧菜单 **Storage & Databases** → **D1**
2. 点击 **Create database**
3. 数据库名称填写 `fkcoding-note-db`，点击 **Create**
4. 创建成功后，复制数据库的 **Database ID**（格式：`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`）
5. 进入数据库详情页，点击 **Console** 标签
6. 将 `migrations/0001_init.sql` 的内容粘贴到控制台输入框，点击 **Execute** 运行初始化

### 步骤二：创建 Pages 项目

1. 左侧菜单 **Workers & Pages** → **Pages**
2. 点击 **Create a project**
3. 选择 **Connect to Git**，授权并选择你的 GitHub 仓库
4. **Build settings** 配置：
   - Framework preset：**None**
   - Build command：留空（无需构建）
   - Build output directory：`public`
5. 点击 **Save and Deploy**，等待首次部署完成

### 步骤三：绑定 D1 数据库

1. 进入刚创建的 Pages 项目，点击 **Settings** 标签
2. 左侧选择 **Bindings**
3. 点击 **Add binding** → 选择 **D1 database**
4. Variable name 填写 `DB`（与代码中 `env.DB` 对应）
5. D1 database 下拉选择 `fkcoding-note-db`
6. 点击 **Save**

### 步骤四：触发重新部署

1. 回到 Pages 项目的 **Deployments** 标签
2. 点击最新部署旁边的 **···** → **Retry deployment**
3. 等待部署成功，访问分配的 `*.pages.dev` 域名

### 步骤五：配置自定义域名（可选）

1. Pages 项目 **Settings** → **Custom domains**
2. 点击 **Set up a custom domain**，按提示添加 CNAME 记录

---

## 八、本地开发

```bash
# 安装 wrangler
npm install -g wrangler

# 登录 Cloudflare
wrangler login

# 创建本地 D1 数据库并初始化
wrangler d1 execute fkcoding-note-db --local --file=./migrations/0001_init.sql

# 启动本地开发服务器（自动代理 Pages Functions）
wrangler pages dev public --d1=DB

# 访问 http://localhost:8788
```

---

## 九、功能开发清单（交给 Claude Code 的任务顺序）

| 阶段 | 任务 |
|------|------|
| Phase 0 | 项目骨架、wrangler.toml、package.json、migrations/0001_init.sql |
| Phase 1 | `functions/_utils.js` 工具函数 |
| Phase 2 | 所有 API Functions（notes/categories/tags/search/stats/upload） |
| Phase 3 | `public/style.css` 全局样式（CSS Variables + 布局） |
| Phase 4 | `public/index.html` + 路由模块 + Store |
| Phase 5 | 侧边栏 + TopBar 组件 |
| Phase 6 | 仪表盘视图（统计卡片 + 热力图 + 最近笔记 + 标签云） |
| Phase 7 | Markdown 编辑器（textarea + 实时预览 + 工具栏 + 自动保存） |
| Phase 8 | 笔记探索页（列表 + 筛选 + 无限滚动） |
| Phase 9 | 全局搜索 Command Palette（⌘K） |
| Phase 10 | 导出功能（Markdown/HTML/打印PDF） |
| Phase 11 | 响应式适配 + 收尾测试 |

---

## 十、关键约束与注意事项

**Cloudflare Workers 运行时限制：**
- 不能使用 Node.js 内置模块（fs、path、crypto 用 Web Crypto API 替代）
- 不能使用需要编译的 npm 包（Functions 是纯 ESM，直接写源码）
- 每个请求 CPU 时间限制 10ms（免费版），避免复杂同步计算

**D1 数据库限制：**
- 不支持 `RETURNING` 语法（需要先 insert 再 select）
- FTS5 全文搜索已内置，直接使用，不需要额外扩展
- base64 图片存入 D1 时注意单行数据大小，建议单张图片控制在 1MB 以内

**前端限制：**
- 不使用构建工具（无 Vite/Webpack），所有依赖通过 CDN 引入
- 使用原生 ES Modules（`<script type="module">`），无需 Babel
- 不使用 React/Vue，原生 DOM 操作或轻量模板字符串渲染
