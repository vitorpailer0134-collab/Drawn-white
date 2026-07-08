// ============================================================
// editor.js
// Controlador da tela de edição. Conecta o CanvasEngine (js puro,
// sem DOM fora do canvas) com o resto da interface: toolbar,
// painel de propriedades, painel de camadas e o botão salvar.
// ============================================================
import { StorageManager } from '../storage.js';
import { CanvasEngine } from './canvasEngine.js';
import { ImageElement } from './shapes.js';

export class EditorController {
  constructor() {
    this.projectId = null;
    this.dom = this._collectDom();
    this.engine = new CanvasEngine(this.dom.canvas, {
      onSelectionChange: (el) => this._renderProps(el),
      onElementsChange: () => { this._renderLayers(); this._markUnsaved(); },
    });
    this._bindToolbar();
    this._bindProps();
    this._bindTopbar();
    this._bindKeyboard();
    this._bindImageUpload();
  }

  _collectDom() {
    return {
      canvas: document.getElementById('main-canvas'),
      toolBtns: document.querySelectorAll('.tool-btn[data-tool]'),
      deleteBtn: document.getElementById('btn-delete-el'),
      propsEmpty: document.getElementById('props-empty'),
      propsFields: document.getElementById('props-fields'),
      color: document.getElementById('prop-color'),
      width: document.getElementById('prop-width'),
      height: document.getElementById('prop-height'),
      opacity: document.getElementById('prop-opacity'),
      widthVal: document.getElementById('prop-w-val'),
      heightVal: document.getElementById('prop-h-val'),
      opacityVal: document.getElementById('prop-op-val'),
      strokeField: document.getElementById('prop-stroke-field'),
      stroke: document.getElementById('prop-stroke'),
      strokeVal: document.getElementById('prop-stroke-val'),
      editTextBtn: document.getElementById('btn-edit-text'),
      layersList: document.getElementById('layers-list'),
      nameInput: document.getElementById('project-name-input'),
      saveStatus: document.getElementById('save-status'),
      saveBtn: document.getElementById('btn-save'),
      exportBtn: document.getElementById('btn-export'),
      backBtn: document.getElementById('btn-back-dashboard'),
      imageInput: document.getElementById('image-upload'),
    };
  }

  /** Abre um projeto existente (ou recém-criado) no editor. */
  open(projectId) {
    this.projectId = projectId;
    const project = StorageManager.getProject(projectId);
    if (!project) return;
    this.dom.nameInput.value = project.name;
    this.engine.clear();
    this.engine.loadFromJSON(project.data?.elements || []);
    this._renderLayers();
    this._renderProps(null);
    this._setTool('select');
    this._markSaved();
  }

  // ---------------- Toolbar ----------------
  _bindToolbar() {
    this.dom.toolBtns.forEach((btn) => {
      btn.addEventListener('click', () => this._setTool(btn.dataset.tool));
    });
    this.dom.deleteBtn.addEventListener('click', () => this.engine.deleteSelected());
  }

  _setTool(tool) {
    this.engine.setTool(tool);
    this.dom.toolBtns.forEach((b) => b.classList.toggle('is-active', b.dataset.tool === tool));
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (document.activeElement.tagName === 'INPUT') return;
      const map = { v: 'select', p: 'pen', r: 'rect', c: 'circle', t: 'text' };
      if (map[e.key.toLowerCase()]) this._setTool(map[e.key.toLowerCase()]);
      if (e.key === 'Delete' || e.key === 'Backspace') this.engine.deleteSelected();
    });
  }

  // ---------------- Upload de imagem ----------------
  _bindImageUpload() {
    this.dom.imageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        const tmp = new Image();
        tmp.onload = () => {
          // Escala a imagem para caber num tamanho razoável no canvas.
          const maxDim = 320;
          const scale = Math.min(1, maxDim / Math.max(tmp.width, tmp.height));
          const el = new ImageElement({
            x: 40, y: 40, width: tmp.width * scale, height: tmp.height * scale, src: dataUrl,
          });
          this.engine.addElement(el);
          this._renderLayers();
          this._markUnsaved();
          this._setTool('select');
        };
        tmp.src = dataUrl;
      };
      reader.readAsDataURL(file);
      e.target.value = ''; // permite reenviar o mesmo arquivo depois
    });
  }

  // ---------------- Painel de propriedades ----------------
  _renderProps(el) {
    const d = this.dom;
    if (!el) {
      d.propsEmpty.hidden = false;
      d.propsFields.hidden = true;
      return;
    }
    d.propsEmpty.hidden = true;
    d.propsFields.hidden = false;

    d.color.value = el.color;
    d.width.value = Math.round(el.width);
    d.height.value = Math.round(el.height);
    d.opacity.value = Math.round(el.opacity * 100);
    d.widthVal.textContent = Math.round(el.width) + 'px';
    d.heightVal.textContent = Math.round(el.height) + 'px';
    d.opacityVal.textContent = Math.round(el.opacity * 100) + '%';

    const isPath = el.type === 'path';
    d.strokeField.hidden = !isPath;
    if (isPath) {
      d.stroke.value = el.strokeWidth;
      d.strokeVal.textContent = el.strokeWidth + 'px';
    }

    d.editTextBtn.hidden = el.type !== 'text';
  }

  _bindProps() {
    const d = this.dom;
    const withSelected = (fn) => {
      const el = this.engine.getSelected();
      if (!el) return;
      fn(el);
      this.engine.render();
      this._renderLayers();
      this._markUnsaved();
    };

    d.color.addEventListener('input', () => withSelected((el) => { el.color = d.color.value; }));

    d.width.addEventListener('input', () => withSelected((el) => {
      el.resize(Number(d.width.value), el.height);
      d.widthVal.textContent = d.width.value + 'px';
    }));
    d.height.addEventListener('input', () => withSelected((el) => {
      el.resize(el.width, Number(d.height.value));
      d.heightVal.textContent = d.height.value + 'px';
    }));
    d.opacity.addEventListener('input', () => withSelected((el) => {
      el.opacity = Number(d.opacity.value) / 100;
      d.opacityVal.textContent = d.opacity.value + '%';
    }));
    d.stroke.addEventListener('input', () => withSelected((el) => {
      if (el.type === 'path') { el.strokeWidth = Number(d.stroke.value); d.strokeVal.textContent = d.stroke.value + 'px'; }
    }));
    d.editTextBtn.addEventListener('click', () => withSelected((el) => {
      if (el.type !== 'text') return;
      const val = window.prompt('Editar texto:', el.text);
      if (val !== null) el.text = val;
    }));
  }

  // ---------------- Painel de camadas ----------------
  _renderLayers() {
    const list = this.dom.layersList;
    list.innerHTML = '';
    const icons = { rect: '▭', circle: '◯', path: '✎', text: 'T', image: '🖼' };
    // exibimos do topo (última camada) para o fundo, refletindo a ordem visual
    [...this.engine.elements].reverse().forEach((el) => {
      const li = document.createElement('li');
      li.className = 'layer-item' + (el.id === this.engine.selectedId ? ' is-selected' : '');
      li.innerHTML = `
        <span class="layer-item__icon">${icons[el.type] || '?'}</span>
        <span class="layer-item__name">${el.label}</span>
        <span class="layer-item__btns">
          <button data-act="up" title="Trazer para frente">↑</button>
          <button data-act="down" title="Enviar para trás">↓</button>
        </span>
      `;
      li.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        this.engine.selectElement(el.id);
      });
      li.querySelector('[data-act="up"]').addEventListener('click', () => this.engine.reorder(el.id, 'up'));
      li.querySelector('[data-act="down"]').addEventListener('click', () => this.engine.reorder(el.id, 'down'));
      list.appendChild(li);
    });
  }

  // ---------------- Topbar: nome, salvar, exportar, voltar ----------------
  _bindTopbar() {
    const d = this.dom;
    d.nameInput.addEventListener('input', () => this._markUnsaved());
    d.saveBtn.addEventListener('click', () => this.save());
    d.exportBtn.addEventListener('click', () => this._exportPng());
    d.backBtn.addEventListener('click', () => {
      this.save();
      window.dispatchEvent(new CustomEvent('navigate:dashboard'));
    });
  }

  _markUnsaved() {
    this.dom.saveStatus.textContent = 'Alterações não salvas';
    this.dom.saveStatus.style.color = 'var(--amber)';
  }
  _markSaved() {
    this.dom.saveStatus.textContent = 'Salvo';
    this.dom.saveStatus.style.color = 'var(--success)';
  }

  /** Salva o estado atual do canvas no LocalStorage (via StorageManager). */
  save() {
    if (!this.projectId) return;
    const data = { elements: this.engine.toJSON(), canvasWidth: this.dom.canvas.width, canvasHeight: this.dom.canvas.height };
    const thumbnail = this.dom.canvas.toDataURL('image/png', 0.6);
    StorageManager.saveProject(this.projectId, { name: this.dom.nameInput.value || 'Sem título', data, thumbnail });
    this._markSaved();
  }

  _exportPng() {
    const link = document.createElement('a');
    link.download = (this.dom.nameInput.value || 'projeto') + '.png';
    link.href = this.dom.canvas.toDataURL('image/png');
    link.click();
  }
}
