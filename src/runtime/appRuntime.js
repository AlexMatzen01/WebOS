export class AppRuntime {
  constructor({ wm, vfs, bus, processManager }) {
    this.wm = wm;
    this.vfs = vfs;
    this.bus = bus;
    this.pm = processManager;
    this.apps = new Map();
    this.permissionCache = new Map();
  }

  register(manifest, factory) {
    this.apps.set(manifest.id, { manifest, factory });
  }

  list() {
    return [...this.apps.values()].map(({ manifest }) => manifest);
  }

  async checkPermissions(manifest) {
    const key = manifest.id;
    if (this.permissionCache.has(key)) return true;
    if (!manifest.permissions?.length) return true;
    const approved = confirm(`${manifest.name} requests permissions:\n- ${manifest.permissions.join('\n- ')}`);
    if (approved) this.permissionCache.set(key, true);
    return approved;
  }

  async launch(appId, opts = {}) {
    const entry = this.apps.get(appId);
    if (!entry) throw new Error(`Unknown app ${appId}`);
    const { manifest, factory } = entry;
    if (!await this.checkPermissions(manifest)) return;
    const root = document.createElement('div');
    root.className = 'app-root';
    const scopedFs = {
      readFile: (path) => this.vfs.readFile(path, appId),
      writeFile: (path, content) => this.vfs.writeFile(path, content, appId),
      mkdir: (path) => this.vfs.mkdir(path, appId),
      list: (path) => this.vfs.list(path),
      get: (path, opts) => this.vfs.get(path, opts),
      symlink: (target, path) => this.vfs.symlink(target, path, appId),
    };

    const ctx = {
      appId,
      manifest,
      bus: this.bus,
      fs: scopedFs,
      background: (fn) => {
        const proc = this.pm.spawn({ name: `${appId}:service`, background: true, type: 'service' });
        fn(() => this.pm.kill(proc.pid));
      },
    };
    await factory(root, ctx, opts);
    this.wm.create({ title: manifest.name, appId, content: root, width: manifest.window?.width, height: manifest.window?.height });
  }
}
