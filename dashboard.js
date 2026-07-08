// ============================================================
// dashboard.js
// Controlador da tela inicial: lista os projetos salvos e
// permite criar/abrir/excluir. Comunica-se com o roteador (main.js)
// via CustomEvents ('navigate:editor') para não depender dele.
// ============================================================
import { StorageManager } from './storage.js';
import { AuthModule } from './auth.js';

export class DashboardController {
  constructor() {
    this.dom = {
      list: document.getElementById('project-list'),
      empty: document.getElementById('empty-state'),
      newBtn: document.getElementById('btn-new-project'),
      logoutBtn: document.getElementById('btn-logout'),
      userLabel: document.getElementById('dash-user-label'),
    };
    this.dom.newBtn.addEventListener('click', () => this._createProject());
    this.dom.logoutBtn.addEventListener('click', () => {
      AuthModule.logout();
      window.dispatchEvent(new CustomEvent('navigate:login'));
    });
  }

  render() {
    this.dom.userLabel.textContent = AuthModule.currentUser() || '';
    const projects = StorageManager.listProjects();
    this.dom.list.innerHTML = '';
    this.dom.empty.hidden = projects.length > 0;

    projects.forEach((p) => {
      const card = document.createElement('div');
      card.className = 'project-card';
      const thumbStyle = p.thumbnail ? `style="background-image:url('${p.thumbnail}')"` : '';
      card.innerHTML = `
        <div class="project-card__thumb" ${thumbStyle}></div>
        <div class="project-card__body">
          <div class="project-card__name">${this._escape(p.name)}</div>
          <div class="project-card__meta">Editado ${this._relativeTime(p.updatedAt)}</div>
        </div>
        <div class="project-card__actions">
          <button class="project-card__del">Excluir</button>
        </div>
      `;
      card.addEventListener('click', (e) => {
        if (e.target.closest('.project-card__del')) return;
        window.dispatchEvent(new CustomEvent('navigate:editor', { detail: { projectId: p.id } }));
      });
      card.querySelector('.project-card__del').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Excluir o projeto "${p.name}"? Essa ação não pode ser desfeita.`)) {
          StorageManager.deleteProject(p.id);
          this.render();
        }
      });
      this.dom.list.appendChild(card);
    });
  }

  _createProject() {
    const project = StorageManager.createProject('Novo projeto');
    window.dispatchEvent(new CustomEvent('navigate:editor', { detail: { projectId: project.id } }));
  }

  _escape(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  _relativeTime(ts) {
    const diffMin = Math.round((Date.now() - ts) / 60000);
    if (diffMin < 1) return 'agora mesmo';
    if (diffMin < 60) return `há ${diffMin} min`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) return `há ${diffH}h`;
    const diffD = Math.round(diffH / 24);
    return `há ${diffD}d`;
  }
}
