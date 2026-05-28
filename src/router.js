import { store } from './store.js';

export class Router {
  constructor() {
    this._routes = new Map();
    this._currentRoute = null;
    this._currentParams = {};
    this._onChange = null;

    window.addEventListener('hashchange', () => this._handleHash());

    document.addEventListener('click', e => {
      const link = e.target.closest('[data-link]');
      if (link) {
        e.preventDefault();
        this.navigate(link.getAttribute('href'));
      }
    });
  }

  on(pattern, handler) {
    const regex = new RegExp('^' + pattern.replace(/:(\w+)/g, '([^/]+)') + '$');
    const paramNames = [...pattern.matchAll(/:(\w+)/g)].map(m => m[1]);
    this._routes.set(pattern, { regex, handler, paramNames });
    return this;
  }

  onChange(fn) {
    this._onChange = fn;
    return this;
  }

  get route() {
    return this._currentRoute;
  }

  get params() {
    return { ...this._currentParams };
  }

  navigate(url) {
    if (!url.startsWith('#')) url = '#' + url;
    window.location.hash = url;
  }

  resolve() {
    const hash = window.location.hash.replace(/^#/, '') || 'home';
    const [path, qs] = hash.split('?');
    const query = Object.fromEntries(new URLSearchParams(qs));

    for (const [pattern, { regex, handler, paramNames }] of this._routes) {
      const match = path.match(regex);
      if (match) {
        const params = {};
        paramNames.forEach((name, i) => { params[name] = match[i + 1]; });
        Object.assign(params, query);
        this._currentRoute = pattern;
        this._currentParams = params;
        try {
          const html = handler(params);
          if (this._onChange) this._onChange(pattern, params, html);
          return html;
        } catch (e) {
          console.error('Route error:', pattern, e);
          return `<div class="container"><div class="card"><h2>Ошибка</h2><p>${e.message}</p></div></div>`;
        }
      }
    }

    return `<div class="container"><h2>404 — Страница не найдена</h2></div>`;
  }

  _handleHash() {
    this.resolve();
  }
}
