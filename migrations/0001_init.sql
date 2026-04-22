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
