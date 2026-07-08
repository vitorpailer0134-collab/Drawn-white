// ============================================================
// storage.js
// Camada de persistência. Hoje usa localStorage, mas toda a
// aplicação só fala com este módulo — trocar por uma API REST
// no futuro significa reescrever só este arquivo.
// ============================================================

const KEYS = {
  SESSION: 'estudio:session',
  PROJECTS: 'estudio:projects', // { [id]: ProjectRecord }
};

/** @typedef {{id:string, name:string, updatedAt:number, thumbnail:string|null, data:object}} ProjectRecord */

export const StorageManager = {
  // ---------------- Sessão / autenticação ----------------
  saveSession(username) {
    localStorage.setItem(KEYS.SESSION, JSON.stringify({ username, loginAt: Date.now() }));
  },
  getSession() {
    const raw = localStorage.getItem(KEYS.SESSION);
    return raw ? JSON.parse(raw) : null;
  },
  clearSession() {
    localStorage.removeItem(KEYS.SESSION);
  },

  // ---------------- Projetos ----------------
  _readAll() {
    const raw = localStorage.getItem(KEYS.PROJECTS);
    return raw ? JSON.parse(raw) : {};
  },
  _writeAll(all) {
    localStorage.setItem(KEYS.PROJECTS, JSON.stringify(all));
  },

  listProjects() {
    const all = this._readAll();
    return Object.values(all).sort((a, b) => b.updatedAt - a.updatedAt);
  },

  getProject(id) {
    const all = this._readAll();
    return all[id] || null;
  },

  /** Cria um projeto vazio e devolve o registro criado. */
  createProject(name = 'Sem título') {
    const all = this._readAll();
    const id = 'proj_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const record = {
      id,
      name,
      updatedAt: Date.now(),
      thumbnail: null,
      data: { elements: [], canvasWidth: 1000, canvasHeight: 640 },
    };
    all[id] = record;
    this._writeAll(all);
    return record;
  },

  /** Atualiza nome/dados/thumbnail de um projeto existente. */
  saveProject(id, { name, data, thumbnail } = {}) {
    const all = this._readAll();
    if (!all[id]) return null;
    if (name !== undefined) all[id].name = name;
    if (data !== undefined) all[id].data = data;
    if (thumbnail !== undefined) all[id].thumbnail = thumbnail;
    all[id].updatedAt = Date.now();
    this._writeAll(all);
    return all[id];
  },

  deleteProject(id) {
    const all = this._readAll();
    delete all[id];
    this._writeAll(all);
  },
};
