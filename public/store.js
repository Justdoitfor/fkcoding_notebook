class Store {
  #state = {
    categories: [],
    tags: [],
    stats: null,
    notes: [],
    currentNote: null,
    searchQuery: '',
    sidebarOpen: true
  }
  #listeners = {}

  setState(key, value) {
    this.#state[key] = value;
    this.#emit(key, value);
  }

  getState(key) {
    return this.#state[key];
  }

  subscribe(key, fn) {
    if (!this.#listeners[key]) {
      this.#listeners[key] = [];
    }
    this.#listeners[key].push(fn);
    return () => {
      this.#listeners[key] = this.#listeners[key].filter(f => f !== fn);
    };
  }

  #emit(key, value) {
    if (this.#listeners[key]) {
      this.#listeners[key].forEach(fn => fn(value));
    }
  }
}

export const store = new Store();
