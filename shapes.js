// ============================================================
// shapes.js
// Define o "modelo" de cada elemento que pode existir no canvas.
// Cada classe sabe: (1) desenhar-se num contexto 2D, (2) dizer
// se um ponto está dentro dela (hit-test), e (3) expor/receber
// um JSON simples para permitir salvar/carregar do LocalStorage.
// ============================================================

let _uid = 0;
const nextId = () => 'el_' + Date.now().toString(36) + '_' + (_uid++);

/** Classe base — todo elemento tem posição, tamanho, cor e opacidade. */
export class BaseElement {
  constructor({ id, x = 0, y = 0, width = 100, height = 100, color = '#7C5CFF', opacity = 1, rotation = 0 } = {}) {
    this.id = id || nextId();
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.color = color;
    this.opacity = opacity;
    this.rotation = rotation; // reservado para uso futuro
  }

  get type() { return 'base'; }
  get label() { return 'Elemento'; }

  /** Retângulo (x,y,w,h) usado para bounding box e handles de resize. */
  getBounds() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  containsPoint(px, py) {
    const b = this.getBounds();
    return px >= b.x && px <= b.x + b.width && py >= b.y && py <= b.y + b.height;
  }

  move(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  resize(width, height) {
    this.width = Math.max(4, width);
    this.height = Math.max(4, height);
  }

  draw(ctx) {
    // implementado nas subclasses
  }

  toJSON() {
    return {
      type: this.type, id: this.id, x: this.x, y: this.y,
      width: this.width, height: this.height, color: this.color,
      opacity: this.opacity, rotation: this.rotation,
    };
  }
}

export class RectElement extends BaseElement {
  get type() { return 'rect'; }
  get label() { return 'Retângulo'; }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);
    ctx.restore();
  }
}

export class CircleElement extends BaseElement {
  get type() { return 'circle'; }
  get label() { return 'Círculo'; }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.fillStyle = this.color;
    const rx = this.width / 2, ry = this.height / 2;
    ctx.beginPath();
    ctx.ellipse(this.x + rx, this.y + ry, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** Traço de desenho livre — guarda uma lista de pontos relativos à origem (x,y). */
export class PathElement extends BaseElement {
  constructor(opts = {}) {
    super(opts);
    this.points = opts.points || []; // [{x,y}, ...] em coordenadas ABSOLUTAS do canvas
    this.strokeWidth = opts.strokeWidth ?? 4;
    if (opts.points) this._recalcBoundsFromPoints();
  }
  get type() { return 'path'; }
  get label() { return 'Desenho'; }

  addPoint(x, y) {
    this.points.push({ x, y });
    this._recalcBoundsFromPoints();
  }

  _recalcBoundsFromPoints() {
    if (!this.points.length) return;
    const xs = this.points.map(p => p.x), ys = this.points.map(p => p.y);
    this.x = Math.min(...xs);
    this.y = Math.min(...ys);
    this.width = Math.max(...xs) - this.x || this.strokeWidth;
    this.height = Math.max(...ys) - this.y || this.strokeWidth;
  }

  /** Redimensiona escalando todos os pontos proporcionalmente à nova largura/altura. */
  resize(width, height) {
    const oldW = this.width || 1, oldH = this.height || 1;
    const sx = Math.max(4, width) / oldW;
    const sy = Math.max(4, height) / oldH;
    this.points = this.points.map(p => ({
      x: this.x + (p.x - this.x) * sx,
      y: this.y + (p.y - this.y) * sy,
    }));
    this.width = Math.max(4, width);
    this.height = Math.max(4, height);
  }

  move(dx, dy) {
    super.move(dx, dy);
    this.points = this.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
  }

  draw(ctx) {
    if (this.points.length < 2) return;
    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.strokeWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) ctx.lineTo(this.points[i].x, this.points[i].y);
    ctx.stroke();
    ctx.restore();
  }

  toJSON() {
    return { ...super.toJSON(), points: this.points, strokeWidth: this.strokeWidth };
  }
}

export class TextElement extends BaseElement {
  constructor(opts = {}) {
    super({ color: '#111111', ...opts });
    this.text = opts.text ?? 'Texto';
    this.fontSize = opts.fontSize ?? 32;
  }
  get type() { return 'text'; }
  get label() { return `“${this.text.slice(0, 14)}”`; }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.fillStyle = this.color;
    ctx.font = `600 ${this.fontSize}px Inter, sans-serif`;
    ctx.textBaseline = 'top';
    // quebra simples de linha respeitando a largura da caixa
    const words = this.text.split(' ');
    let line = '', lines = [];
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > this.width && line) { lines.push(line); line = w; }
      else line = test;
    }
    lines.push(line);
    lines.forEach((l, i) => ctx.fillText(l, this.x, this.y + i * this.fontSize * 1.2));
    this.height = Math.max(this.fontSize * 1.4, lines.length * this.fontSize * 1.2);
    ctx.restore();
  }

  toJSON() {
    return { ...super.toJSON(), text: this.text, fontSize: this.fontSize };
  }
}

export class ImageElement extends BaseElement {
  constructor(opts = {}) {
    super(opts);
    this.src = opts.src; // dataURL — permite salvar/carregar via localStorage
    this._img = new Image();
    this._loaded = false;
    this._img.onload = () => { this._loaded = true; };
    this._img.src = this.src;
  }
  get type() { return 'image'; }
  get label() { return 'Imagem'; }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.opacity;
    if (this._loaded) {
      ctx.drawImage(this._img, this.x, this.y, this.width, this.height);
    } else {
      ctx.fillStyle = '#33323d';
      ctx.fillRect(this.x, this.y, this.width, this.height);
    }
    ctx.restore();
  }

  toJSON() {
    return { ...super.toJSON(), src: this.src };
  }
}

/** Fábrica: reconstrói a classe correta a partir do JSON salvo. */
export function elementFromJSON(json) {
  switch (json.type) {
    case 'rect': return new RectElement(json);
    case 'circle': return new CircleElement(json);
    case 'path': return new PathElement(json);
    case 'text': return new TextElement(json);
    case 'image': return new ImageElement(json);
    default: throw new Error('Tipo de elemento desconhecido: ' + json.type);
  }
}
