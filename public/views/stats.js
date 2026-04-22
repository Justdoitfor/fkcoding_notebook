import { store } from '../store.js';

export class StatsView {
  constructor(container) {
    this.container = container;
  }

  async render() {
    const stats = store.getState('stats') || {};
    
    const html = \`
      <div style="padding:20px;max-width:1100px">
        <div class="stats-grid" style="margin-bottom:20px">
          <div class="stat-card">
            <div class="stat-label">总字数</div>
            <div class="stat-num">\${Math.round((stats.total_words||0)/1000)}k</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">分类数</div>
            <div class="stat-num">\${stats.category_count||0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">标签数</div>
            <div class="stat-num">\${stats.tag_count||0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">总笔记</div>
            <div class="stat-num">\${stats.note_count||0}</div>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><div class="card-title">月度创作量</div></div>
          <div class="chart-bars" id="monthly-chart"></div>
          <div style="display:flex;gap:0" id="monthly-labels"></div>
        </div>

        <div class="card" style="margin-top:16px">
          <div class="card-head"><div class="card-title">常用标签</div></div>
          <div class="tag-cloud" id="tag-cloud">
            \${store.getState('tags')?.map(t => \`<div class="tag-pill" style="border:1px solid var(--border2)">\${t.name}</div>\`).join('') || ''}
          </div>
        </div>
      </div>
    \`;

    this.container.innerHTML = html;
    this.renderMonthlyChart(stats.activity || []);
  }

  renderMonthlyChart(activity) {
    const vals = [12,8,15,6,18,11,9,22,16,14,20,28]; // Mock data if empty
    const months = ['5月','6月','7月','8月','9月','10月','11月','12月','1月','2月','3月','4月'];
    const chart = this.container.querySelector('#monthly-chart');
    const labels = this.container.querySelector('#monthly-labels');
    if(!chart || !labels) return;

    const max = Math.max(...vals);
    chart.innerHTML = vals.map((v, i) => \`
      <div style="flex:1;display:flex;flex-direction:column;align-items:center">
        <div class="chart-bar" style="height:\${Math.round(v/max*100)}%;width:100%;background:\${i===11?'var(--accent)':'var(--accent-bg)'}">
          <div class="chart-bar-val">\${v}</div>
        </div>
      </div>
    \`).join('');
    labels.innerHTML = months.map(m => \`<div class="chart-bar-label" style="flex:1">\${m}</div>\`).join('');
  }
}
