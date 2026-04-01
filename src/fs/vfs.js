const DB_NAME = 'localos.vfs';
const STORE = 'nodes';

const now = () => Date.now();
const norm = (p) => ('/' + (p || '').split('/').filter(Boolean).join('/')) || '/';

export class VFS {
  constructor(bus) {
    this.bus = bus;
    this.cache = new Map();
    this.mounts = new Map([
      ['/home', { type: 'persistent' }],
      ['/system', { type: 'readonly' }],
      ['/mnt', { type: 'mount-root' }],
      ['/dev', { type: 'virtual' }],
    ]);
    this.virtualDevices = {
      '/dev/null': () => '',
      '/dev/random': () => String(Math.random()),
    };
  }

  async init() {
    this.db = await this.openDB();
    await this.bootstrap();
  }

  openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'path' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  tx(mode = 'readonly') {
    return this.db.transaction(STORE, mode).objectStore(STORE);
  }

  async put(node) {
    this.cache.set(node.path, node);
    await new Promise((res, rej) => {
      const req = this.tx('readwrite').put(node);
      req.onsuccess = () => res();
      req.onerror = () => rej(req.error);
    });
  }

  async get(path, { followLinks = true } = {}) {
    path = norm(path);
    if (path in this.virtualDevices) {
      return { path, type: 'device', permissions: { '*': 'rwx' } };
    }
    if (this.cache.has(path)) return this.resolveLink(this.cache.get(path), followLinks);
    const node = await new Promise((res, rej) => {
      const req = this.tx().get(path);
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => rej(req.error);
    });
    if (node) this.cache.set(path, node);
    return this.resolveLink(node, followLinks);
  }

  async resolveLink(node, follow) {
    if (!node || node.type !== 'symlink' || !follow) return node;
    return this.get(node.target, { followLinks: true });
  }

  async list(path) {
    const dir = await this.get(path);
    if (!dir || dir.type !== 'dir') throw new Error('Not a directory');
    return Promise.all((dir.children || []).map((p) => this.get(p, { followLinks: false })));
  }

  canAccess(node, appId = '*', mode = 'r') {
    if (!node) return false;
    const acl = node.permissions?.[appId] ?? node.permissions?.['*'] ?? 'rwx';
    return acl.includes(mode);
  }

  async writeFile(path, content, appId = '*') {
    path = norm(path);
    const parent = await this.get(path.split('/').slice(0, -1).join('/') || '/');
    if (!parent || parent.type !== 'dir') throw new Error('Parent not dir');

    const existing = await this.get(path, { followLinks: false });
    const data = {
      path,
      type: 'file',
      content,
      size: content.length,
      createdAt: existing?.createdAt ?? now(),
      updatedAt: now(),
      permissions: existing?.permissions ?? { '*': 'rw' },
      owner: existing?.owner ?? 'guest',
    };
    if (!this.canAccess({ permissions: data.permissions }, appId, existing ? 'w' : 'w')) throw new Error('Permission denied');
    await this.put(data);
    if (!parent.children.includes(path)) {
      parent.children.push(path);
      parent.updatedAt = now();
      await this.put(parent);
    }
    this.bus.emit('vfs:write', { path, size: data.size });
  }

  async readFile(path, appId = '*') {
    path = norm(path);
    if (path in this.virtualDevices) return this.virtualDevices[path]();
    const node = await this.get(path);
    if (!node || node.type !== 'file') throw new Error('File not found');
    if (!this.canAccess(node, appId, 'r')) throw new Error('Permission denied');
    return node.content;
  }

  async mkdir(path, appId = '*') {
    path = norm(path);
    const parentPath = path.split('/').slice(0, -1).join('/') || '/';
    const parent = await this.get(parentPath);
    if (!parent || parent.type !== 'dir') throw new Error('Parent not found');
    if (!this.canAccess(parent, appId, 'w')) throw new Error('Permission denied');
    const existing = await this.get(path, { followLinks: false });
    if (existing) return;
    const node = { path, type: 'dir', children: [], size: 0, createdAt: now(), updatedAt: now(), permissions: { '*': 'rwx' }, owner: 'guest' };
    parent.children.push(path);
    await this.put(node);
    await this.put(parent);
  }

  async symlink(target, path) {
    path = norm(path);
    const parent = await this.get(path.split('/').slice(0, -1).join('/') || '/');
    const node = { path, type: 'symlink', target: norm(target), createdAt: now(), updatedAt: now(), permissions: { '*': 'rwx' }, owner: 'guest' };
    parent.children.push(path);
    await this.put(node);
    await this.put(parent);
  }

  async bootstrap() {
    const root = await this.get('/');
    if (root) return;
    const dirs = ['/', '/home', '/system', '/mnt', '/dev', '/home/guest', '/home/guest/Desktop', '/home/guest/Documents', '/system/bin'];
    for (const dir of dirs) {
      await this.put({ path: dir, type: 'dir', children: [], size: 0, createdAt: now(), updatedAt: now(), permissions: { '*': dir.startsWith('/system') ? 'r-x' : 'rwx' }, owner: 'root' });
    }
    for (const dir of dirs.slice(1)) {
      const parentPath = dir.split('/').slice(0, -1).join('/') || '/';
      const parent = await this.get(parentPath, { followLinks: false });
      if (!parent.children.includes(dir)) {
        parent.children.push(dir);
        await this.put(parent);
      }
    }
    await this.writeFile('/home/guest/readme.txt', 'Welcome to LocalOS 2 / LocalOS runtime', '*');
    await this.writeFile('/system/bin/echo.exe', 'builtin:echo', '*');
  }
}
