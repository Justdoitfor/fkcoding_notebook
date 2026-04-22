export class Router {
  constructor() {
    this.routes = [];
    window.addEventListener('popstate', () => this.handleRoute());
  }

  on(path, handler) {
    // 将路径转换为正则表达式（支持 :id 参数）
    const regexPath = path.replace(/:[^\s/]+/g, '([\\w-]+)');
    this.routes.push({
      pattern: new RegExp(\`^\${regexPath}$\`),
      path,
      handler
    });
  }

  navigate(path) {
    window.history.pushState({}, '', path);
    this.handleRoute();
  }

  handleRoute() {
    const path = window.location.pathname;
    let found = false;

    for (const route of this.routes) {
      const match = path.match(route.pattern);
      if (match) {
        // 提取参数并传递给处理器
        const params = match.slice(1);
        route.handler(...params);
        found = true;
        break;
      }
    }

    if (!found) {
      // 默认重定向或 404
      this.navigate('/');
    }
  }
}

export const router = new Router();
