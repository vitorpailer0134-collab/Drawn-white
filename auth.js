// ============================================================
// auth.js
// Autenticação "mock": não existe backend real, apenas uma
// validação de credenciais fixas. Troque `validate()` por uma
// chamada fetch('/api/login') quando tiver um servidor de verdade.
// ============================================================
import { StorageManager } from './storage.js';

const MOCK_USERS = [
  { user: 'demo', pass: '1234' },
  { user: 'admin', pass: 'admin' },
];

export const AuthModule = {
  /** @returns {boolean} */
  validate(user, pass) {
    return MOCK_USERS.some((u) => u.user === user && u.pass === pass);
  },

  login(user, pass) {
    if (!this.validate(user, pass)) return false;
    StorageManager.saveSession(user);
    return true;
  },

  logout() {
    StorageManager.clearSession();
  },

  isAuthenticated() {
    return !!StorageManager.getSession();
  },

  currentUser() {
    const s = StorageManager.getSession();
    return s ? s.username : null;
  },
};
