// ============================================================
// canvasEngine.js
// Responsável por TUDO que acontece dentro do <canvas>:
// - manter a lista de elementos (camadas, do fundo pro topo)
// - desenhar o quadro inteiro a cada frame necessário
// - interpretar mouse/touch para criar, mover, redimensionar e
//   selecionar elementos, de acordo com a ferramenta ativa
// Não conhece o resto da UI (painéis) — comunica-se por callbacks.
// ============================================================
import { RectElement, CircleElement, PathElement, TextElement, ImageElement, elementFromJSON } from './shapes.js';

const HANDLE_SIZE = 9;

export class CanvasEngine {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{onSelectionChange:Function, onElementsChange:Function, onRequestTextEdit:Function}} callbacks
   */
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.elements = []; // ordem = camadas, índice 0 é o fundo
    this.selectedId = null;
    this.tool = 'select';
    this.callbacks = callbacks;

    // estado de interação em andamento
    this._drag = null; // {mode:'move'|'resize'|'draw'|'pan', ...}

    this._bindEvents();
  }

  // ---------------- API pública ----------------

  setTool(tool) {
    this.tool = tool;
    this.canvas.classList.toggle('tool-select', tool === 'select');
    this.canvas.style.cursor = tool === 'select' ? 'default' : 'crosshair';
  }

  addElement(el) {
    this.elements.push(el);
    this.selectElement(el.id);
    this.render();
  }

  selectElement(id) {
    this.selectedId = id;
    this.callbacks.onSelectionChange?.(this.getSelected());
    this.render();
  }

  getSelected() {
    return this.elements.find(e => e.id === this.selectedId) || null;
  }

  deleteSelected() {
    if (!this.selectedId) return;
    this.elements = this.elements.filter(e => e.id !== this.selectedId);
    this.selectElement(null);
    this.callbacks.onElementsChange?.();
  }

  /** Move um elemento uma posição para cima/baixo na pilha de camadas. */
  reorder(id, direction) {
    const i = this.elements.findIndex(e => e.id === id);
    if (i < 0) return;
    const j = direction === 'up' ? i + 1 : i - 1;
    if (j < 0 || j >= this.elements.length) return;
    [this.elements[i], this.elements[j]] = [this.elements[j], this.elements[i]];
    this.render();
    this.callbacks.onElementsChange?.();
  }

  clear() {
    this.elements = [];
    this.selectElement(null);
  }

  /** Serializa todas as camadas para salvar. */
  toJSON() {
    return this.elements.map(e => e.toJSON());
  }

  /** Recria as camadas a partir de um JSON salvo anteriormente. */
  loadFromJSON(json = []) {
    this.elements = json.map(elementFromJSON);
    this.selectElement(null);
    this.render();
  }

  render() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const el of this.elements) el.draw(ctx);
    const sel = this.getSelected();
    if (sel) this._drawSelectionBox(sel);
  }

  // ---------------- Desenho da caixa de seleção + handles ----------------
  _drawSelectionBox(el) {
    const { ctx } = this;
    const b = el.getBounds();
    ctx.save();
    ctx.strokeStyle = '#7C5CFF';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(b.x, b.y, b.width, b.height);
    ctx.setLineDash([]);
    ctx.fillStyle = '#7C5CFF';
    for (const h of this._handlePositions(b)) {
      ctx.fillRect(h.x - HANDLE_SIZE / 2, h.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
    }
    ctx.restore();
  }

  _handlePositions(b) {
    return [
      { name: 'nw', x: b.x, y: b.y },
      { name: 'ne', x: b.x + b.width, y: b.y },
      { name: 'sw', x: b.x, y: b.y + b.height },
      { name: 'se', x: b.x + b.width, y: b.y + b.height },
    ];
  }

  _hitHandle(el, px, py) {
    const b = el.getBounds();
    for (const h of this._handlePositions(b)) {
      if (Math.abs(px - h.x) <= HANDLE_SIZE && Math.abs(py - h.y) <= HANDLE_SIZE) return h.name;
    }
    return null;
  }

  /** Encontra o elemento visível mais no topo sob o ponto (px,py). */
  _hitElement(px, py) {
    for (let i = this.elements.length - 1; i >= 0; i--) {
      if (this.elements[i].containsPoint(px, py)) return this.elements[i];
    }
    return null;
  }

  _getPos(evt) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (evt.clientX - rect.left) * scaleX,
      y: (evt.clientY - rect.top) * scaleY,
    };
  }

  // ---------------- Interação de mouse ----------------
  _bindEvents() {
    this.canvas.addEventListener('mousedown', (e) => this._onDown(e));
    window.addEventListener('mousemove', (e) => this._onMove(e));
    window.addEventListener('mouseup', () => this._onUp());
    this.canvas.addEventListener('dblclick', (e) => this._onDblClick(e));
  }

  _onDown(evt) {
    const { x, y } = this._getPos(evt);

    if (this.tool === 'select') {
      const sel = this.getSelected();
      const handle = sel ? this._hitHandle(sel, x, y) : null;
      if (handle) {
        this._drag = { mode: 'resize', handle, startX: x, startY: y, orig: { ...sel.getBounds() } };
        return;
      }
      const hit = this._hitElement(x, y);
      if (hit) {
        this.selectElement(hit.id);
        this._drag = { mode: 'move', startX: x, startY: y };
      } else {
        this.selectElement(null);
      }
      return;
    }

    if (this.tool === 'rect' || this.tool === 'circle') {
      const Ctor = this.tool === 'rect' ? RectElement : CircleElement;
      const el = new Ctor({ x, y, width: 1, height: 1, color: '#7C5CFF' });
      this.elements.push(el);
      this.selectElement(el.id);
      this._drag = { mode: 'draw-shape', startX: x, startY: y, el };
      return;
    }

    if (this.tool === 'pen') {
      const el = new PathElement({ x, y, color: '#111111', strokeWidth: 4 });
      el.addPoint(x, y);
      this.elements.push(el);
      this.selectElement(el.id);
      this._drag = { mode: 'draw-path', el };
      return;
    }

    if (this.tool === 'text') {
      const content = window.prompt('Digite o texto:', 'Texto');
      if (content === null) return;
      const el = new TextElement({ x, y, width: 260, height: 40, text: content, color: '#111111' });
      this.addElement(el);
      this.callbacks.onElementsChange?.();
      this.setTool('select');
      this.callbacks.onToolChangeRequest?.('select');
    }
  }

  _onMove(evt) {
    if (!this._drag) return;
    const { x, y } = this._getPos(evt);
    const d = this._drag;

    if (d.mode === 'move') {
      const sel = this.getSelected();
      if (!sel) return;
      const dx = x - d.startX, dy = y - d.startY;
      sel.move(dx, dy);
      d.startX = x; d.startY = y;
      this.render();
    } else if (d.mode === 'resize') {
      const sel = this.getSelected();
      if (!sel) return;
      this._applyResize(sel, d, x, y);
      this.render();
    } else if (d.mode === 'draw-shape') {
      const w = x - d.startX, h = y - d.startY;
      d.el.x = w < 0 ? x : d.startX;
      d.el.y = h < 0 ? y : d.startY;
      d.el.width = Math.abs(w);
      d.el.height = Math.abs(h);
      this.render();
    } else if (d.mode === 'draw-path') {
      d.el.addPoint(x, y);
      this.render();
    }
  }

  _applyResize(sel, d, x, y) {
    const o = d.orig;
    let newX = o.x, newY = o.y, newW = o.width, newH = o.height;
    const dx = x - d.startX, dy = y - d.startY;
    if (d.handle.includes('e')) newW = o.width + dx;
    if (d.handle.includes('s')) newH = o.height + dy;
    if (d.handle.includes('w')) { newW = o.width - dx; newX = o.x + dx; }
    if (d.handle.includes('n')) { newH = o.height - dy; newY = o.y + dy; }
    sel.x = newX; sel.y = newY;
    sel.resize(Math.max(4, newW), Math.max(4, newH));
  }

  _onUp() {
    if (this._drag) {
      this.callbacks.onElementsChange?.();
    }
    this._drag = null;
  }

  _onDblClick(evt) {
    const { x, y } = this._getPos(evt);
    const hit = this._hitElement(x, y);
    if (hit && hit.type === 'text') {
      const val = window.prompt('Editar texto:', hit.text);
      if (val !== null) { hit.text = val; this.render(); this.callbacks.onElementsChange?.(); }
    }
  }
}
