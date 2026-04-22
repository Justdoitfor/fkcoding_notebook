import { store } from '../store.js';
import { router } from '../router.js';

export function renderSidebar(container) {
  const activePage = store.getState('activePage');
  const categories = store.getState('categories') || [];
  
  const html = \`
<div class="sidebar">
  <div class="sidebar-logo">
    <div class="logo-icon">fk/</div>
    <div>
      <div class="logo-text">fkcoding<span>-note</span></div>
    </div>
  </div>

  <div class="sidebar-section">
    <div class="sidebar-label">工作区</div>
    <div class="nav-item \${activePage === 'dashboard' ? 'active' : ''}" data-path="/">
      <div class="nav-icon">⊞</div> 仪表盘
    </div>
    <div class="nav-item \${activePage === 'tutorials' ? 'active' : ''}" data-path="/tutorials">
      <div class="nav-icon">📚</div> 教程库
      \${store.getState('stats')?.note_count ? \`<div class="nav-badge">\${store.getState('stats').note_count}</div>\` : ''}
    </div>
    <div class="nav-item \${activePage === 'editor' ? 'active' : ''}" data-path="/editor">
      <div class="nav-icon">✏️</div> 编辑器
    </div>
    <div class="nav-item \${activePage === 'stats' ? 'active' : ''}" data-path="/stats">
      <div class="nav-icon">📊</div> 数据统计
    </div>
  </div>

  <div class="sidebar-section" style="margin-top:10px">
    <div class="sidebar-label">分类</div>
    \${categories.map(c => \`
      <div class="nav-item" data-category="\${c.id}">
        <div class="nav-icon">\${c.icon}</div> \${c.name}
      </div>
    \`).join('')}
    <div class="nav-item" id="new-category-btn">
      <div class="nav-icon" style="color:var(--ink3)">+</div>
      <span style="color:var(--ink3); font-size:12px">新建分类</span>
    </div>
  </div>

  <div class="sidebar-footer">
    <div class="user-pill">
      <div class="user-avatar">FK</div>
      <div>
        <div class="user-name">fkcoder</div>
        <div class="user-plan">Pro · \${store.getState('stats')?.note_count || 0} 篇笔记</div>
      </div>
    </div>
  </div>
</div>
  \`;
  container.innerHTML = html;
  
  // 绑定事件
  container.querySelectorAll('[data-path]').forEach(el => {
    el.addEventListener('click', () => {
      router.navigate(el.dataset.path);
    });
  });

  container.querySelectorAll('[data-category]').forEach(el => {
    el.addEventListener('click', () => {
      router.navigate('/tutorials?category=' + el.dataset.category);
    });
  });

  container.querySelector('#new-category-btn').addEventListener('click', () => {
    // 显示新建分类弹窗等逻辑
    alert('新建分类功能待实现');
  });
}
