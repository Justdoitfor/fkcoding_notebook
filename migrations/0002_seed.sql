INSERT INTO categories (id, name, slug, description, icon, color, sort_order) VALUES
('c1', '前端开发', 'frontend', '前端技术栈', '🌐', '#DBEAFE', 1),
('c2', '后端工程', 'backend', '后端技术栈', '⚙️', '#DCFCE7', 2),
('c3', '算法与数据结构', 'algorithm', '算法', '🧮', '#FEF3C7', 3),
('c4', '开发工具', 'tools', '工具', '🔧', '#EDE9FE', 4);

INSERT INTO tags (id, name, slug, color) VALUES
('t1', 'React', 'react', '#1D4ED8'),
('t2', 'TypeScript', 'typescript', '#6D28D9'),
('t3', 'Node.js', 'nodejs', '#15803D');

INSERT INTO notes (id, title, content, excerpt, slug, status, category_id, word_count, read_time) VALUES
('n1', 'React Hooks 完全指南', '# React Hooks\n\n测试内容', 'React Hooks 简介', 'react-hooks-guide', 'published', 'c1', 100, 1),
('n2', 'Node.js 流式处理实战', '# Node.js Stream\n\n测试内容', 'Node.js Stream 简介', 'nodejs-stream', 'published', 'c2', 200, 1);

INSERT INTO notes_tags (note_id, tag_id) VALUES
('n1', 't1'), ('n2', 't3');
