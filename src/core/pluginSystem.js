export class PluginSystem {
  constructor({ bus, appRuntime, shell }) {
    this.bus = bus;
    this.appRuntime = appRuntime;
    this.shell = shell;
    this.plugins = new Map();
  }

  register(plugin) {
    if (!plugin?.id) throw new Error('Plugin requires id');
    this.plugins.set(plugin.id, plugin);
    plugin.activate?.({ bus: this.bus, appRuntime: this.appRuntime, shell: this.shell });
    this.bus.emit('plugin:registered', { id: plugin.id });
  }

  unregister(id) {
    const plugin = this.plugins.get(id);
    if (!plugin) return;
    plugin.deactivate?.();
    this.plugins.delete(id);
    this.bus.emit('plugin:unregistered', { id });
  }

  list() {
    return [...this.plugins.values()].map((p) => ({ id: p.id, name: p.name ?? p.id }));
  }
}
