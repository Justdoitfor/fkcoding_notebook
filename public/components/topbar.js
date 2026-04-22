import { store } from '../store.js';

export function renderTopBar(container) {
  const activePage = store.getState('activePage');
  const titles = { dashboard:'仪表盘', tutorials:'教程库', editor:'编辑器', stats:'数据统计' };
  
  container.innerHTML = \`
  <div class="topbar">
    <div class="topbar-left">
      <div class="breadcrumb">
        <span>fkcoding-note</span>
        <span class="breadcrumb-sep">/</span>
        <b id="breadcrumb-title">\${titles[activePage] || '应用'}</b>
      </div>
      <div class="search-box">
        <span style="color:var(--ink3);font-size:12px">🔍</span>
        <input type="text" placeholder="搜索教程、笔记、标签..." id="searchInput">
      </div>
    </div>
    <div class="topbar-right">
      <button class="btn" id="sync-btn">↑ 同步</button>
      <button class="btn btn-accent" id="new-tut-btn">+ 新建教程</button>
    </div>
  </div>
  \`;

  container.querySelector('#searchInput').addEventListener('input', (e) => {
    // TODO: 实现全局搜索
    console.log('Search:', e.target.value);
  });

  container.querySelector('#new-tut-btn').addEventListener('click', () => {
    // 跳转到编辑器
    import('../router.js').then(({ router }) => router.navigate('/editor'));
  });

  store.subscribe('activePage', (pageId) => {
    const el = container.querySelector('#breadcrumb-title');
    if (el) el.textContent = titles[pageId] || pageId;
  });
}
