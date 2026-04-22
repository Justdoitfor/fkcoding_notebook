import { notesApi } from '../api.js';
import { router } from '../router.js';

export class TutorialsView {
  constructor(container, params) {
    this.container = container;
    this.category = new URLSearchParams(window.location.search).get('category');
    this.status = 'all';
    this.notes = [];
  }

  async render() {
    this.container.innerHTML = \`<div style="padding:20px">加载中...</div>\`;
    await this.fetchNotes();

    const html = \`
      <div style="padding:20px;max-width:1200px">
        <div class="filter-bar">
          <div class="filter-tabs">
            <button class="filter-tab \${this.status === 'all' ? 'active' : ''}" data-status="all">全部</button>
            <button class="filter-tab \${this.status === 'published' ? 'active' : ''}" data-status="published">已发布</button>
            <button class="filter-tab \${this.status === 'draft' ? 'active' : ''}" data-status="draft">草稿</button>
            <button class="filter-tab \${this.status === 'archived' ? 'active' : ''}" data-status="archived">归档</button>
          </div>
          \${this.category ? \`<div style="font-size:12px;color:var(--accent);margin-left:10px">当前分类过滤: \${this.category} <span style="cursor:pointer" id="clear-cat">✕</span></div>\` : ''}
        </div>
        <div class="tut-grid" id="tut-grid">
          \${this.renderGrid()}
        </div>
      </div>
    \`;

    this.container.innerHTML = html;
    this.bindEvents();
  }

  renderGrid() {
    if (!this.notes.length) return \`<div style="color:var(--ink3);font-size:13px">没有找到笔记。</div>\`;
    
    return this.notes.map(t => \`
      <div class="tut-card" data-id="\${t.id}">
        <div class="tut-card-icon">\${t.category_icon || '📄'}</div>
        <div class="tut-card-title">\${t.title}</div>
        <div class="tut-card-desc">\${t.category_name || '未分类'} \${t.tags.length ? '· ' + t.tags.map(tg=>tg.name).join(' · ') : ''}</div>
        <div class="tut-card-footer">
          <div class="tut-card-stats">
            <span>📝 \${Math.round((t.word_count||0)/1000)}k 字</span>
            <span>🕐 \${new Date(t.updated_at).toLocaleDateString()}</span>
          </div>
          <span class="tut-badge \${t.status==='published'?'badge-green':'badge-amber'}">\${t.status==='published'?'已发布':'草稿'}</span>
        </div>
      </div>
    \`).join('');
  }

  async fetchNotes() {
    try {
      const params = {};
      if (this.category) params.category = this.category;
      if (this.status !== 'all') params.status = this.status;
      
      const res = await notesApi.list(params);
      this.notes = res.notes;
    } catch (e) {
      console.error(e);
      window.showToast?.('获取失败', 'error');
    }
  }

  bindEvents() {
    this.container.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', async (e) => {
        this.status = e.target.dataset.status;
        await this.render();
      });
    });

    this.container.querySelector('#clear-cat')?.addEventListener('click', async () => {
      this.category = null;
      router.navigate('/tutorials'); // Update URL
      await this.render();
    });

    this.container.querySelectorAll('.tut-card').forEach(card => {
      card.addEventListener('click', () => {
        router.navigate(\`/editor/\${card.dataset.id}\`);
      });
    });
  }
}
