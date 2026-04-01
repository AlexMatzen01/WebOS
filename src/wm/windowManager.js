export class WindowManager {
  constructor({ root, taskbar, desktops = 3, processManager }) {
    this.root = root;
    this.taskbar = taskbar;
    this.pm = processManager;
    this.z = 50;
    this.windows = new Map();
    this.currentDesktop = 0;
    this.desktops = Array.from({ length: desktops }, () => new Set());
  }

  create({ title, appId, content, width = 760, height = 480 }) {
    const proc = this.pm.spawn({ name: appId, type: 'app' });
    const id = `win-${proc.pid}`;
    const el = document.createElement('section');
    el.className = 'window';
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    el.style.left = `${120 + Math.random() * 220}px`;
    el.style.top = `${80 + Math.random() * 120}px`;
    el.dataset.desktop = String(this.currentDesktop);
    el.innerHTML = `<header class="window-header"><span>${title}</span><div><button data-act="min">—</button><button data-act="max">▢</button><button data-act="close">✕</button></div></header><div class="window-body"></div><div class="window-resize"></div>`;
    el.querySelector('.window-body').append(content);
    this.root.append(el);
    this.desktops[this.currentDesktop].add(id);
    this.windows.set(id, { id, el, proc, state: 'normal', appId });
    this.bindWindow(id);
    this.focus(id);
    this.addTaskItem(id, title);
    return id;
  }

  bindWindow(id) {
    const model = this.windows.get(id);
    const header = model.el.querySelector('.window-header');
    header.addEventListener('pointerdown', (e) => this.startDrag(e, model.el));
    model.el.querySelector('[data-act="close"]').addEventListener('click', () => this.close(id));
    model.el.querySelector('[data-act="min"]').addEventListener('click', () => this.minimize(id));
    model.el.querySelector('[data-act="max"]').addEventListener('click', () => this.maximize(id));
    model.el.addEventListener('mousedown', () => this.focus(id));
    model.el.querySelector('.window-resize').addEventListener('pointerdown', (e) => this.startResize(e, model.el));
  }

  startDrag(e, el) {
    this.focus([...this.windows.entries()].find(([, w]) => w.el === el)?.[0]);
    const startX = e.clientX, startY = e.clientY;
    const rect = el.getBoundingClientRect();
    const onMove = (ev) => {
      el.style.left = `${rect.left + ev.clientX - startX}px`;
      el.style.top = `${Math.max(0, rect.top + ev.clientY - startY)}px`;
      this.applySnap(el);
    };
    const onUp = () => window.removeEventListener('pointermove', onMove);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  }

  startResize(e, el) {
    const rect = el.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;
    const move = (ev) => {
      el.style.width = `${Math.max(340, rect.width + ev.clientX - sx)}px`;
      el.style.height = `${Math.max(220, rect.height + ev.clientY - sy)}px`;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', () => window.removeEventListener('pointermove', move), { once: true });
  }

  applySnap(el) {
    const w = window.innerWidth;
    const r = el.getBoundingClientRect();
    if (r.left < 12) { el.style.left = '0px'; el.style.top = '0px'; el.style.width = `${Math.floor(w / 2)}px`; el.style.height = 'calc(100vh - 56px)'; }
    if (r.right > w - 12) { el.style.left = `${Math.floor(w / 2)}px`; el.style.top = '0px'; el.style.width = `${Math.floor(w / 2)}px`; el.style.height = 'calc(100vh - 56px)'; }
  }

  focus(id) {
    const w = this.windows.get(id); if (!w) return;
    w.el.style.zIndex = String(++this.z);
    this.taskbar.querySelectorAll('.task-item').forEach((b) => b.classList.toggle('active', b.dataset.win === id));
  }

  minimize(id) { const w = this.windows.get(id); if (w) { w.el.classList.add('is-minimized'); this.pm.setState(w.proc.pid, 'sleeping'); } }
  maximize(id) { const w = this.windows.get(id); if (!w) return; w.el.classList.toggle('is-max'); }

  close(id) {
    const w = this.windows.get(id); if (!w) return;
    this.pm.kill(w.proc.pid);
    w.el.remove();
    this.taskbar.querySelector(`.task-item[data-win="${id}"]`)?.remove();
    this.windows.delete(id);
  }

  switchDesktop(index) {
    this.currentDesktop = index;
    for (const w of this.windows.values()) {
      w.el.style.display = Number(w.el.dataset.desktop) === index ? '' : 'none';
    }
  }

  addTaskItem(id, title) {
    const b = document.createElement('button');
    b.className = 'task-item active';
    b.dataset.win = id;
    b.textContent = title;
    b.onclick = () => {
      const w = this.windows.get(id);
      if (!w) return;
      w.el.classList.remove('is-minimized');
      this.pm.setState(w.proc.pid, 'running');
      this.focus(id);
    };
    this.taskbar.append(b);
  }
}
