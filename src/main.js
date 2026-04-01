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

  document.getElementById('start-btn').onclick = () => document.getElementById('start-menu').classList.toggle('hidden');
  document.querySelectorAll('.desktop-icon').forEach((icon) => icon.onclick = () => appRuntime.launch(icon.dataset.app));

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

window.LocalOS = { saveUsers, state };
