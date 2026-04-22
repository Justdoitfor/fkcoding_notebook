import { router } from './router.js';
import { store } from './store.js';
import { categoriesApi, statsApi, tagsApi } from './api.js';

// 组件
import { renderSidebar } from './components/sidebar.js';
import { renderTopBar } from './components/topbar.js';
import { renderToastContainer } from './components/toast.js';

// 视图
import { DashboardView } from './views/dashboard.js';
import { EditorView } from './views/editor.js';
import { TutorialsView } from './views/tutorials.js';
import { StatsView } from './views/stats.js';

class App {
  constructor() {
    this.appEl = document.getElementById('app');
    this.init();
  }

  async init() {
    this.renderLayout();
    
    // 初始化数据
    await this.fetchInitialData();
    
    // 配置路由
    router.on('/', () => this.switchView(DashboardView, 'dashboard'));
    router.on('/tutorials', () => this.switchView(TutorialsView, 'tutorials'));
    router.on('/editor', () => this.switchView(EditorView, 'editor'));
    router.on('/editor/:id', (id) => this.switchView(EditorView, 'editor', { id }));
    router.on('/stats', () => this.switchView(StatsView, 'stats'));
    
    // 首次路由解析
    router.handleRoute();

    // 订阅分类/标签数据变化重新渲染 Sidebar
    store.subscribe('categories', () => this.updateSidebar());
  }

  renderLayout() {
    this.appEl.innerHTML = \`
      <div style="display:flex;height:100vh;width:100vw;overflow:hidden">
        <div id="sidebar-container"></div>
        <div class="main">
          <div id="topbar-container"></div>
          <div id="page-container" class="page active" style="padding:0"></div>
        </div>
      </div>
      <div id="toast-container" class="toast-container"></div>
    \`;
    this.updateSidebar();
    renderTopBar(document.getElementById('topbar-container'));
    renderToastContainer(document.getElementById('toast-container'));
  }

  updateSidebar() {
    renderSidebar(document.getElementById('sidebar-container'));
  }

  async fetchInitialData() {
    try {
      const [cats, tags, stats] = await Promise.all([
        categoriesApi.list().catch(()=>([])),
        tagsApi.list().catch(()=>([])),
        statsApi.get().catch(()=>({}))
      ]);
      store.setState('categories', cats);
      store.setState('tags', tags);
      store.setState('stats', stats);
    } catch (e) {
      console.error('Failed to fetch initial data', e);
    }
  }

  switchView(ViewClass, pageId, params = {}) {
    const container = document.getElementById('page-container');
    container.innerHTML = '';
    const view = new ViewClass(container, params);
    view.render();
    
    // 更新 TopBar 和 Sidebar 高亮
    store.setState('activePage', pageId);
  }
}

new App();
