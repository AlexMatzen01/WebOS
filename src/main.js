import { EventBus } from './core/eventBus.js';
import { ProcessManager } from './core/processManager.js';
import { VFS } from './fs/vfs.js';
import { Shell } from './terminal/shell.js';
import { WindowManager } from './wm/windowManager.js';
import { AppRuntime } from './runtime/appRuntime.js';
import { PluginSystem } from './core/pluginSystem.js';
import { registerBuiltinApps } from './apps/builtinApps.js';

const SETTINGS_KEY = 'localos.settings.v4';
const USERS_KEY = 'localos.users.v1';
const STUDIO_APPS_KEY = 'localos.appstudio.apps.v1';
const DESKTOP_SHORTCUTS_KEY = 'localos.desktop.shortcuts.v1';

const defaultSettings = { theme: 'dark', accent: '#22d3ee', animations: true, wallpaper: 'Aurora' };
const state = {
  user: null,
  settings: { ...defaultSettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') },
  users: JSON.parse(localStorage.getItem(USERS_KEY) || '[{"username":"guest","pin":"1234"}]'),
};

function saveSettings() { localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings)); }
function saveUsers() { localStorage.setItem(USERS_KEY, JSON.stringify(state.users)); }

function setupClock() {
  const el = document.getElementById('clock');
  setInterval(() => { el.textContent = new Date().toLocaleTimeString(); }, 1000);
}

function applyTheme() {
  document.body.dataset.theme = state.settings.theme;
  document.documentElement.style.setProperty('--accent', state.settings.accent);
}

function notify(text) {
  const tray = document.getElementById('notifications');
  const item = document.createElement('div');
  item.className = 'notification';
  item.textContent = text;
  tray.append(item);
  setTimeout(() => item.remove(), 3500);
}

function setupClipboardManager() {
  const clips = JSON.parse(localStorage.getItem('localos.clipboard') || '[]');
  document.addEventListener('copy', async () => {
    const txt = await navigator.clipboard.readText().catch(() => '');
    if (txt) {
      clips.unshift({ txt, ts: Date.now() });
      localStorage.setItem('localos.clipboard', JSON.stringify(clips.slice(0, 30)));
    }
  });
}

function renderLogin(onLogin) {
  const lock = document.getElementById('lock-screen');
  lock.innerHTML = `<div class='lock-card'><h2>LocalOS Login</h2><select id='userSel'></select><input id='pin' type='password' placeholder='PIN'/><button id='unlock'>Unlock</button></div>`;
  const sel = lock.querySelector('#userSel');
  state.users.forEach((u) => {
    const o = document.createElement('option');
    o.value = u.username; o.textContent = u.username; sel.append(o);
  });
  lock.querySelector('#unlock').onclick = () => {
    const user = state.users.find((u) => u.username === sel.value && u.pin === lock.querySelector('#pin').value);
    if (!user) return alert('Invalid credentials');
    state.user = user.username;
    lock.classList.add('hidden');
    onLogin();
  };
}

function readStudioApps() {
  try {
    return JSON.parse(localStorage.getItem(STUDIO_APPS_KEY) || '[]');
  } catch {
    return [];
  }
}

function readDesktopShortcuts() {
  try {
    const raw = localStorage.getItem(DESKTOP_SHORTCUTS_KEY);
    if (!raw) {
      return ['terminal', 'files', 'browser', 'editor', 'taskmgr', 'appstudio'];
    }
    return JSON.parse(raw);
  } catch {
    return ['terminal', 'files', 'browser', 'editor', 'taskmgr', 'appstudio'];
  }
}

function registerStudioApp(appRuntime, appDef) {
  if (!appDef?.id || !appDef?.name) return;
  const manifest = {
    id: appDef.id,
    name: appDef.name,
    icon: appDef.icon || '🧩',
    permissions: Array.isArray(appDef.permissions) ? appDef.permissions : ['fs.read', 'fs.write'],
    window: {
      width: Number(appDef.window?.width) || 900,
      height: Number(appDef.window?.height) || 620,
    },
  };

  appRuntime.register(manifest, async (root, ctx) => {
    const frame = document.createElement('iframe');
    frame.sandbox = 'allow-scripts';
    frame.style.border = '0';
    frame.style.width = '100%';
    frame.style.height = '100%';
    root.append(frame);

    const html = appDef.html || '<main><h1>Untitled App</h1></main>';
    const css = appDef.css || '';
    const js = appDef.js || '';
    const assets = appDef.assets || {};

    frame.srcdoc = `<!doctype html><html><head><meta charset="UTF-8"/><style>${css}</style></head><body>${html}
      <script>
      (() => {
        const pending = new Map();
        const callHost = (method, args = []) => {
          const id = crypto.randomUUID();
          parent.postMessage({ type: 'localos-api', id, method, args }, '*');
          return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
        };
        window.addEventListener('message', (event) => {
          const data = event.data || {};
          if (data.type !== 'localos-api-result' || !pending.has(data.id)) return;
          const pendingCall = pending.get(data.id);
          pending.delete(data.id);
          if (data.error) pendingCall.reject(new Error(data.error));
          else pendingCall.resolve(data.result);
        });
        window.LocalOS = {
          fs: {
            readFile: (path) => callHost('fs.readFile', [path]),
            writeFile: (path, content) => callHost('fs.writeFile', [path, content]),
            mkdir: (path) => callHost('fs.mkdir', [path]),
            list: (path) => callHost('fs.list', [path]),
          },
          assets: {
            getUrl: (name) => callHost('assets.getUrl', [name]),
            list: () => callHost('assets.list', []),
          },
          notify: (msg) => parent.postMessage({ type: 'localos-log', message: String(msg) }, '*')
        };
      })();
      </script>
      <script type="module">${js}</script>
    </body></html>`;

    window.addEventListener('message', async (event) => {
      if (event.source !== frame.contentWindow) return;
      const data = event.data || {};
      if (data.type === 'localos-log') {
        notify(`[${appDef.name}] ${data.message}`);
        return;
      }
      if (data.type !== 'localos-api') return;
      const reply = { type: 'localos-api-result', id: data.id };
      try {
        if (data.method === 'fs.readFile') reply.result = await ctx.fs.readFile(data.args[0], ctx.appId);
        else if (data.method === 'fs.writeFile') {
          await ctx.fs.writeFile(data.args[0], data.args[1], ctx.appId);
          reply.result = true;
        } else if (data.method === 'fs.mkdir') {
          await ctx.fs.mkdir(data.args[0], ctx.appId);
          reply.result = true;
        } else if (data.method === 'fs.list') {
          reply.result = await ctx.fs.list(data.args[0]);
        } else if (data.method === 'assets.getUrl') {
          reply.result = assets[data.args[0]] ?? '';
        } else if (data.method === 'assets.list') {
          reply.result = Object.keys(assets);
        } else {
          throw new Error(`Unknown LocalOS API method: ${data.method}`);
        }
      } catch (error) {
        reply.error = error.message;
      }
      frame.contentWindow?.postMessage(reply, '*');
    });
  });
}

function renderDesktopIcons(appRuntime) {
  const iconGrid = document.getElementById('icon-grid');
  iconGrid.innerHTML = '';
  const shortcutIds = new Set(readDesktopShortcuts());
  for (const app of appRuntime.list()) {
    if (!shortcutIds.has(app.id)) continue;
    const icon = document.createElement('button');
    icon.className = 'desktop-icon';
    icon.dataset.app = app.id;
    icon.textContent = `${app.icon || '◻'} ${app.name}`;
    iconGrid.append(icon);
  }
}

async function boot() {
  applyTheme();
  setupClock();
  setupClipboardManager();

  const bus = new EventBus();
  const processManager = new ProcessManager(bus);
  const vfs = new VFS(bus);
  await vfs.init();

  const wm = new WindowManager({ root: document.getElementById('window-layer'), taskbar: document.getElementById('task-items'), processManager });
  const appRuntime = new AppRuntime({ wm, vfs, bus, processManager });
  const shell = new Shell({ vfs, bus, processManager, appRuntime });
  const plugins = new PluginSystem({ bus, appRuntime, shell });

  registerBuiltinApps({ appRuntime, shell, processManager });
  for (const studioApp of readStudioApps()) registerStudioApp(appRuntime, studioApp);

  plugins.register({
    id: 'system-notifier',
    activate({ bus }) {
      bus.on('vfs:write', ({ path }) => notify(`Saved ${path}`));
      bus.on('process:spawn', ({ name, pid }) => notify(`Started ${name} (${pid})`));
    },
  });

  const startList = document.getElementById('start-list');
  const renderStart = () => {
    startList.innerHTML = '';
    for (const app of appRuntime.list()) {
      const b = document.createElement('button');
      b.textContent = `${app.icon || '◻'} ${app.name}`;
      b.onclick = () => appRuntime.launch(app.id);
      startList.append(b);
    }
  };
  renderStart();
  renderDesktopIcons(appRuntime);

  bus.on('app:registered', () => {
    renderStart();
    renderDesktopIcons(appRuntime);
  });

  document.getElementById('start-btn').onclick = () => document.getElementById('start-menu').classList.toggle('hidden');
  document.getElementById('icon-grid').addEventListener('click', (event) => {
    const button = event.target.closest('.desktop-icon');
    if (!button) return;
    appRuntime.launch(button.dataset.app);
  });

  document.getElementById('desktop-switcher').onclick = () => {
    wm.switchDesktop((wm.currentDesktop + 1) % 3);
    notify(`Desktop ${wm.currentDesktop + 1}`);
  };

  document.getElementById('open-settings').onclick = () => {
    const panel = document.getElementById('quick-settings');
    panel.classList.toggle('hidden');
  };
  document.getElementById('theme').onchange = (e) => { state.settings.theme = e.target.value; saveSettings(); applyTheme(); };
  document.getElementById('accent').onchange = (e) => { state.settings.accent = e.target.value; saveSettings(); applyTheme(); };

  appRuntime.launch('terminal');
}

renderLogin(boot);

window.LocalOS = { saveUsers, state, registerStudioApp, readStudioApps, readDesktopShortcuts, STUDIO_APPS_KEY, DESKTOP_SHORTCUTS_KEY };
