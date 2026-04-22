import { store } from '../store.js';
import { notesApi } from '../api.js';
import { router } from '../router.js';

export class DashboardView {
  constructor(container) {
    this.container = container;
  }

  async render() {
    this.container.innerHTML = '<div style="padding:20px">加载中...</div>';
    
    // Fetch data needed for dashboard
    let recentNotes = [];
    try {
      const res = await notesApi.list({ limit: 5 });
      recentNotes = res.notes;
    } catch (e) {
      console.error(e);
    }
    
    const stats = store.getState('stats') || {};

    const html = \`
      <div style="padding: 20px; max-width: 1200px">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">教程总数</div>
            <div class="stat-num">\${stats.note_count || 0}</div>
            <div class="stat-trend">↑ 本月新增</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">笔记字数</div>
            <div class="stat-num">\${Math.round((stats.total_words||0)/1000)}k</div>
            <div class="stat-trend">↑ 持续创作</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">连续创作</div>
            <div class="stat-num">🔥 0</div>
            <div class="stat-sub">天不间断</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">分类数</div>
            <div class="stat-num">\${stats.category_count || 0}</div>
            <div class="stat-sub">持续构建中</div>
          </div>
        </div>

        <div class="two-col">
          <div style="display:flex;flex-direction:column;gap:14px">
            <div class="card">
              <div class="card-head">
                <div class="card-title">最近编辑</div>
                <div class="card-action" id="view-all-recent">查看全部 →</div>
              </div>
              <div class="tut-list">
                \${recentNotes.length ? recentNotes.map(t => \`
                  <div class="tut-row" data-id="\${t.id}">
                    <div class="tut-icon" style="background:#F5F4F0">📄</div>
                    <div class="tut-info">
                      <div class="tut-name">\${t.title}</div>
                      <div class="tut-meta">\${t.category_name || '未分类'} · \${new Date(t.updated_at).toLocaleDateString()}</div>
                    </div>
                    <span class="tut-badge \${t.status==='published'?'badge-green':'badge-amber'}">\${t.status==='published'?'已发布':'草稿'}</span>
                  </div>
                \`).join('') : '<div style="font-size:12px;color:var(--ink3);padding:10px">暂无笔记</div>'}
              </div>
            </div>
            <div class="card">
              <div class="card-head">
                <div class="card-title">创作热力图</div>
                <span style="font-size:11px;color:var(--ink3)">近 90 天</span>
              </div>
              <div class="heatmap" id="heatmap"></div>
              <div style="display:flex;gap:5px;align-items:center;margin-top:8px;justify-content:flex-end">
                <span style="font-size:10px;color:var(--ink3)">少</span>
                <div style="width:9px;height:9px;border-radius:2px;background:#EEF0EC"></div>
                <div style="width:9px;height:9px;border-radius:2px;background:#BBF7D0"></div>
                <div style="width:9px;height:9px;border-radius:2px;background:#4ADE80"></div>
                <div style="width:9px;height:9px;border-radius:2px;background:#16A34A"></div>
                <div style="width:9px;height:9px;border-radius:2px;background:#166534"></div>
                <span style="font-size:10px;color:var(--ink3)">多</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    \`;

    this.container.innerHTML = html;

    // Render Heatmap
    this.renderHeatmap();

    // Bind Events
    this.container.querySelector('#view-all-recent')?.addEventListener('click', () => {
      router.navigate('/tutorials');
    });

    this.container.querySelectorAll('.tut-row').forEach(row => {
      row.addEventListener('click', () => {
        router.navigate(\`/editor/\${row.dataset.id}\`);
      });
    });
  }

  renderHeatmap() {
    const hm = this.container.querySelector('#heatmap');
    if (!hm) return;
    const lvls = Array(90).fill(0).map(() => Math.floor(Math.random() * 5)); // 模拟数据
    lvls.forEach((l, i) => {
      const c = document.createElement('div');
      c.className = 'hm-cell' + (l > 0 ? ' l'+l : '');
      c.title = \`\${90-i}天前：记录了 \${l*2} 次\`;
      hm.appendChild(c);
    });
  }
}
