// ============================================================
// main.js
// Ponto de entrada. Faz o papel de um "roteador" simples entre
// as três telas (login, dashboard, editor), usando atributos
// hidden para alternar visibilidade — sem framework, só DOM.
// ============================================================
import { AuthModule } from './auth.js';
import { DashboardController } from './dashboard.js';
import { EditorController } from './editor/editor.js';

const screens = {
  login: document.getElementById('screen-login'),
  dashboard: document.getElementById('screen-dashboard'),
  editor: document.getElementById('screen-editor'),
};

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => { el.hidden = key !== name; });
}

// Instâncias únicas dos controladores (criadas uma vez, reusadas a cada navegação)
const dashboard = new DashboardController();
let editor = null; // criado sob demanda pois depende do <canvas> já visível

// ---------------- Login ----------------
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const user = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value;
  if (AuthModule.login(user, pass)) {
    loginError.hidden = true;
    goToDashboard();
  } else {
    loginError.hidden = false;
  }
});

// ---------------- Navegação ----------------
function goToDashboard() {
  showScreen('dashboard');
  dashboard.render();
}

function goToEditor(projectId) {
  showScreen('editor');
  // O canvas precisa estar visível (não `hidden`) antes de medirmos/desenharmos nele,
  // por isso o EditorController só é instanciado aqui, na primeira vez que é necessário.
  if (!editor) editor = new EditorController();
  editor.open(projectId);
}

window.addEventListener('navigate:dashboard', goToDashboard);
window.addEventListener('navigate:login', () => showScreen('login'));
window.addEventListener('navigate:editor', (e) => goToEditor(e.detail.projectId));

// ---------------- Bootstrap: decide a tela inicial ----------------
if (AuthModule.isAuthenticated()) {
  goToDashboard();
} else {
  showScreen('login');
}
