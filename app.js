const STORAGE_KEY = 'localos.fs.v1';
const SETTINGS_KEY = 'localos.settings.v2';

const defaultFS = {
  '/': { type: 'dir', children: ['home', 'apps', 'bin', 'docs'] },
  '/home': { type: 'dir', children: ['readme.txt', 'hello.los', 'notes.txt'] },
  '/apps': { type: 'dir', children: ['about.app'] },
  '/bin': { type: 'dir', children: ['echo.exe'] },
  '/docs': { type: 'dir', children: ['roadmap.txt'] },
  '/home/readme.txt': {
    type: 'file',
    kind: 'text',
    content: 'Welcome to LocalOS. Try: help, pwd, ls /home, cat /home/readme.txt, run /home/hello.los',
  },
  '/home/notes.txt': {
    type: 'file',
    kind: 'text',
    content: 'Ideas:\n- Build apps\n- Customize themes\n- Automate with LOS',
  },
  '/home/hello.los': {
    type: 'file',
    kind: 'script',
    content: 'PRINT "Hello from LocalOS Script"\nSET name "friend"\nPRINT "Hi, $name"\n',
  },
  '/docs/roadmap.txt': {
    type: 'file',
    kind: 'text',
    content: 'Roadmap:\n1. Better multitasking\n2. Better filesystem UX\n3. New commands',
  },
  '/apps/about.app': { type: 'file', kind: 'app', content: 'about' },
  '/bin/echo.exe': { type: 'file', kind: 'exec', content: 'echo' },
};

const defaultSettings = { theme: 'dark', homepage: 'https://example.com' };

const state = {
  fs: loadFS(),
  settings: loadSettings(),
  cwd: '/home',
  windows: new Map(),
  zCounter: 30,
  winCounter: 0,
};

function loadFS() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : structuredClone(defaultFS);
}

function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  return raw ? JSON.parse(raw) : structuredClone(defaultSettings);
}

function saveFS() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.fs));
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function normalizePath(path) {
  const parts = path.split('/').filter(Boolean);
  return '/' + parts.join('/');
}

function resolvePath(path) {
  if (!path) return state.cwd;
  if (path.startsWith('/')) return normalizePath(path);

  const cwdParts = state.cwd.split('/').filter(Boolean);
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') cwdParts.pop();
    else cwdParts.push(part);
  }
  return '/' + cwdParts.join('/');
}

function basename(path) {
  if (path === '/') return '/';
  return path.split('/').filter(Boolean).at(-1);
}

function dirname(path) {
  if (path === '/') return '/';
  const parts = path.split('/').filter(Boolean);
  parts.pop();
  return parts.length ? `/${parts.join('/')}` : '/';
}

function ensureDir(path) {
  return state.fs[path] && state.fs[path].type === 'dir';
}

function childrenOf(path) {
  const item = state.fs[path];
  if (!item || item.type !== 'dir') return [];
  return item.children.map((name) => `${path === '/' ? '' : path}/${name}`);
}

function parseArgs(raw) {
  return raw.match(/"[^"]*"|[^\s]+/g)?.map((x) => x.replace(/^"|"$/g, '')) ?? [];
}

function removePath(path) {
  const target = state.fs[path];
  if (!target || path === '/') return false;

  if (target.type === 'dir') {
    for (const child of [...childrenOf(path)]) removePath(child);
  }

  const parent = dirname(path);
  if (state.fs[parent]?.type === 'dir') {
    state.fs[parent].children = state.fs[parent].children.filter((name) => name !== basename(path));
  }

  delete state.fs[path];
  return true;
}

function movePath(srcPath, dstPath) {
  if (!state.fs[srcPath] || srcPath === '/' || state.fs[dstPath]) return false;
  const srcBase = basename(srcPath);
  const srcParent = dirname(srcPath);
  const dstParent = dirname(dstPath);
  const dstBase = basename(dstPath);

  if (!ensureDir(dstParent)) return false;

  const remap = {};
  for (const path of Object.keys(state.fs)) {
    if (path === srcPath || path.startsWith(`${srcPath}/`)) {
      const suffix = path.slice(srcPath.length);
      remap[path] = `${dstPath}${suffix}`;
    }
  }

  const movedEntries = Object.entries(remap)
    .sort((a, b) => a[0].length - b[0].length)
    .map(([oldPath, newPath]) => [newPath, structuredClone(state.fs[oldPath])]);

  for (const oldPath of Object.keys(remap).sort((a, b) => b.length - a.length)) {
    delete state.fs[oldPath];
  }
  for (const [newPath, node] of movedEntries) state.fs[newPath] = node;

  state.fs[srcParent].children = state.fs[srcParent].children.filter((name) => name !== srcBase);
  state.fs[dstParent].children.push(dstBase);

  if (state.cwd === srcPath || state.cwd.startsWith(`${srcPath}/`)) {
    state.cwd = state.cwd.replace(srcPath, dstPath);
  }

  return true;
}

function runLocalScript(source, stdout) {
  const vars = {};
  for (const line of source.split('\n')) {
    const clean = line.trim();
    if (!clean || clean.startsWith('#')) continue;

    const [cmd, ...rest] = parseArgs(clean);
    if (cmd === 'PRINT') {
      const text = rest.join(' ').replace(/\$([a-zA-Z_]\w*)/g, (_, n) => vars[n] ?? '');
      stdout(text);
    } else if (cmd === 'SET') {
      vars[rest[0]] = rest.slice(1).join(' ');
    } else {
      stdout(`Unknown LOS command: ${cmd}`);
    }
  }
}

function renderTree(path, depth = 0) {
  const node = state.fs[path];
  if (!node) return [];

  const label = `${'  '.repeat(depth)}${depth === 0 ? path : basename(path)}`;
  const lines = [label];

  if (node.type === 'dir') {
    for (const child of childrenOf(path).sort()) {
      lines.push(...renderTree(child, depth + 1));
    }
  }
  return lines;
}

function terminalCommand(input, stdout) {
  const [cmd, ...args] = parseArgs(input);
  const target = args[0];

  switch (cmd) {
    case 'help':
      stdout('Commands: help, pwd, ls [dir], tree [dir], cd <dir>, cat <file>, write <file> <text>, mkdir <dir>, touch <file>, rm <path>, mv <src> <dst>, cp <src> <dst>, run <script>, exec <binary>, date, whoami, clear');
      break;
    case 'pwd':
      stdout(state.cwd);
      break;
    case 'date':
      stdout(new Date().toString());
      break;
    case 'whoami':
      stdout('localos');
      break;
    case 'ls': {
      const path = resolvePath(target);
      const items = childrenOf(path);

      if (!ensureDir(path)) {
        stdout('directory not found');
        break;
      }

      stdout(items.length
        ? items
            .sort()
            .map((p) => `${basename(p)} (${state.fs[p].kind || state.fs[p].type})`)
            .join('\n')
        : '(empty)');
      break;
    }
    case 'tree': {
      const path = resolvePath(target);
      if (!state.fs[path]) {
        stdout('path not found');
        break;
      }
      stdout(renderTree(path).join('\n'));
      break;
    }
    case 'cd': {
      const path = resolvePath(target);
      if (!ensureDir(path)) {
        stdout('directory not found');
        break;
      }
      state.cwd = path;
      break;
    }
    case 'cat': {
      const path = resolvePath(target);
      if (state.fs[path]?.content != null) stdout(state.fs[path].content);
      else stdout('file not found');
      break;
    }
    case 'write': {
      const [rawPath, ...text] = args;
      const path = resolvePath(rawPath);
      if (!state.fs[path] || state.fs[path].type !== 'file') {
        stdout('file not found');
        break;
      }
      state.fs[path].content = text.join(' ');
      saveFS();
      stdout('saved');
      break;
    }
    case 'mkdir': {
      const path = resolvePath(target);
      const parent = dirname(path);
      const name = basename(path);
      if (!name || !ensureDir(parent)) {
        stdout('invalid path');
        break;
      }
      if (state.fs[path]) {
        stdout('exists');
        break;
      }
      state.fs[path] = { type: 'dir', children: [] };
      state.fs[parent].children.push(name);
      saveFS();
      stdout('directory created');
      break;
    }
    case 'touch': {
      const path = resolvePath(target);
      const parent = dirname(path);
      const name = basename(path);
      if (!name || !ensureDir(parent)) {
        stdout('invalid path');
        break;
      }
      if (state.fs[path]) {
        stdout('exists');
        break;
      }
      state.fs[path] = { type: 'file', kind: 'text', content: '' };
      state.fs[parent].children.push(name);
      saveFS();
      stdout('file created');
      break;
    }
    case 'rm': {
      const path = resolvePath(target);
      if (!removePath(path)) stdout('path not found');
      else {
        saveFS();
        stdout('removed');
      }
      break;
    }
    case 'mv': {
      const src = resolvePath(args[0]);
      const dst = resolvePath(args[1]);
      if (!args[0] || !args[1]) {
        stdout('usage: mv <src> <dst>');
        break;
      }
      if (!movePath(src, dst)) stdout('move failed');
      else {
        saveFS();
        stdout('moved');
      }
      break;
    }
    case 'cp': {
      const src = resolvePath(args[0]);
      const dst = resolvePath(args[1]);
      if (!args[0] || !args[1] || !state.fs[src] || state.fs[dst]) {
        stdout('copy failed');
        break;
      }
      const parent = dirname(dst);
      if (!ensureDir(parent)) {
        stdout('copy failed');
        break;
      }
      const mappings = [];
      for (const path of Object.keys(state.fs)) {
        if (path === src || path.startsWith(`${src}/`)) {
          const suffix = path.slice(src.length);
          mappings.push([path, `${dst}${suffix}`]);
        }
      }
      mappings.sort((a, b) => a[0].length - b[0].length);
      for (const [oldPath, newPath] of mappings) {
        state.fs[newPath] = structuredClone(state.fs[oldPath]);
      }
      state.fs[parent].children.push(basename(dst));
      saveFS();
      stdout('copied');
      break;
    }
    case 'run': {
      const path = resolvePath(target);
      const file = state.fs[path];
      if (!file || file.kind !== 'script') {
        stdout('script not found');
        break;
      }
      runLocalScript(file.content, stdout);
      break;
    }
    case 'exec': {
      const path = resolvePath(target);
      const file = state.fs[path];
      if (!file || file.kind !== 'exec') {
        stdout('executable not found');
        break;
      }
      if (file.content === 'echo') stdout(args.slice(1).join(' '));
      break;
    }
    case 'clear':
    case 'cls':
      return '__CLEAR__';
    default:
      stdout(`Unknown command: ${cmd || ''}`);
  }
}

function focusWindow(win) {
  state.zCounter += 1;
  win.style.zIndex = String(state.zCounter);
}

function makeDraggable(win, handle) {
  let active = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  handle.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    active = true;
    focusWindow(win);
    const rect = win.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    startX = e.clientX;
    startY = e.clientY;
    win.style.transform = 'none';
    win.style.left = `${startLeft}px`;
    win.style.top = `${startTop}px`;
  });

  window.addEventListener('mousemove', (e) => {
    if (!active) return;
    const nx = startLeft + (e.clientX - startX);
    const ny = startTop + (e.clientY - startY);
    win.style.left = `${Math.max(8, nx)}px`;
    win.style.top = `${Math.max(40, ny)}px`;
  });

  window.addEventListener('mouseup', () => {
    active = false;
  });
}

function renderTaskbar() {
  const container = document.getElementById('task-items');
  container.innerHTML = '';

  for (const [id, meta] of state.windows) {
    const btn = document.createElement('button');
    btn.className = `task-item${meta.minimized ? '' : ' active'}`;
    btn.textContent = meta.title;
    btn.title = meta.title;
    btn.addEventListener('click', () => {
      if (meta.minimized) {
        meta.minimized = false;
        meta.node.classList.remove('is-minimized');
        focusWindow(meta.node);
      } else {
        meta.minimized = true;
        meta.node.classList.add('is-minimized');
      }
      renderTaskbar();
    });
    container.appendChild(btn);
  }
}

function createWindow(title, render) {
  const tpl = document.getElementById('window-template');
  const node = tpl.content.firstElementChild.cloneNode(true);
  const id = `w-${++state.winCounter}`;

  node.dataset.windowId = id;
  node.querySelector('.window-title').textContent = title;
  const header = node.querySelector('.window-header');
  const closeBtn = node.querySelector('.close');
  const minimizeBtn = node.querySelector('.minimize');

  closeBtn.addEventListener('click', () => {
    state.windows.delete(id);
    node.remove();
    renderTaskbar();
  });

  minimizeBtn.addEventListener('click', () => {
    const meta = state.windows.get(id);
    meta.minimized = true;
    node.classList.add('is-minimized');
    renderTaskbar();
  });

  node.addEventListener('mousedown', () => focusWindow(node));
  makeDraggable(node, header);

  const body = node.querySelector('.window-body');
  render(body);

  document.getElementById('window-layer').appendChild(node);
  focusWindow(node);
  state.windows.set(id, { id, title, node, minimized: false });
  renderTaskbar();
}

function appTerminal(body) {
  body.innerHTML = `
    <div class="panel small">Enhanced shell with path-aware prompt and filesystem tools.</div>
    <pre class="terminal-output" id="term-out"></pre>
    <div class="row">
      <input id="term-in" placeholder="Type a command" />
      <button id="term-run">Run</button>
    </div>`;

  const out = body.querySelector('#term-out');
  const input = body.querySelector('#term-in');
  const print = (msg) => {
    out.textContent += (out.textContent ? '\n' : '') + msg;
    out.scrollTop = out.scrollHeight;
  };

  const execute = () => {
    const cmd = input.value.trim();
    if (!cmd) return;
    print(`localos@machine:${state.cwd}$ ${cmd}`);
    const result = terminalCommand(cmd, print);
    if (result === '__CLEAR__') out.textContent = '';
    input.value = '';
  };

  print(`localos@machine:${state.cwd}$ help`);
  terminalCommand('help', print);

  body.querySelector('#term-run').addEventListener('click', execute);
  input.addEventListener('keydown', (e) => e.key === 'Enter' && execute());
}

function appFiles(body) {
  body.innerHTML = `
    <div class="panel small">Interactive file explorer with quick create/edit actions.</div>
    <div class="row file-toolbar">
      <button id="up">Up</button>
      <button id="new-folder">New Folder</button>
      <button id="new-file">New Text File</button>
      <input id="path-display" readonly />
    </div>
    <ul class="file-list" id="file-list"></ul>
    <label>Preview / Edit
      <textarea id="editor"></textarea>
    </label>
    <div class="row"><button id="save-file">Save File</button><button id="refresh">Refresh</button></div>`;

  const list = body.querySelector('#file-list');
  const pathDisplay = body.querySelector('#path-display');
  const editor = body.querySelector('#editor');
  let currentDir = state.cwd;
  let openFilePath = null;

  const renderList = () => {
    list.innerHTML = '';
    pathDisplay.value = currentDir;

    const children = childrenOf(currentDir).sort();
    if (!children.length) {
      const li = document.createElement('li');
      li.innerHTML = '<span>(empty)</span>';
      list.appendChild(li);
      return;
    }

    for (const path of children) {
      const li = document.createElement('li');
      const item = state.fs[path];
      li.innerHTML = `<span>${basename(path)}</span><span class="small">${item.kind || item.type}</span>`;
      li.addEventListener('click', () => {
        if (item.type === 'dir') {
          currentDir = path;
          renderList();
          return;
        }
        openFilePath = path;
        editor.value = item.content ?? '';
      });
      list.appendChild(li);
    }
  };

  body.querySelector('#up').addEventListener('click', () => {
    currentDir = dirname(currentDir);
    renderList();
  });

  body.querySelector('#new-folder').addEventListener('click', () => {
    const name = prompt('Folder name?');
    if (!name) return;
    const path = `${currentDir === '/' ? '' : currentDir}/${name}`;
    if (state.fs[path]) return alert('Already exists');
    state.fs[path] = { type: 'dir', children: [] };
    state.fs[currentDir].children.push(name);
    saveFS();
    renderList();
  });

  body.querySelector('#new-file').addEventListener('click', () => {
    const name = prompt('File name?');
    if (!name) return;
    const path = `${currentDir === '/' ? '' : currentDir}/${name}`;
    if (state.fs[path]) return alert('Already exists');
    state.fs[path] = { type: 'file', kind: 'text', content: '' };
    state.fs[currentDir].children.push(name);
    saveFS();
    renderList();
  });

  body.querySelector('#save-file').addEventListener('click', () => {
    if (!openFilePath || !state.fs[openFilePath] || state.fs[openFilePath].type !== 'file') return alert('Open a file first');
    state.fs[openFilePath].content = editor.value;
    if (!state.fs[openFilePath].kind) state.fs[openFilePath].kind = 'text';
    saveFS();
    alert('Saved');
  });

  body.querySelector('#refresh').addEventListener('click', renderList);
  renderList();
}

function applyTheme(themeName) {
  document.body.dataset.theme = themeName;
}

function appSettings(body) {
  body.innerHTML = `
    <div class="panel">
      <label>Theme
        <select id="theme">
          <option value="dark">Dark</option>
          <option value="midnight">Midnight</option>
          <option value="sunrise">Sunrise</option>
        </select>
      </label>
      <label>Browser homepage
        <input id="homepage" />
      </label>
      <div class="row"><button id="save">Save Settings</button><button id="reset">Reset Filesystem</button></div>
    </div>`;

  const theme = body.querySelector('#theme');
  const homepage = body.querySelector('#homepage');
  theme.value = state.settings.theme;
  homepage.value = state.settings.homepage;

  theme.addEventListener('change', () => applyTheme(theme.value));

  body.querySelector('#save').addEventListener('click', () => {
    state.settings.theme = theme.value;
    state.settings.homepage = homepage.value;
    applyTheme(theme.value);
    saveSettings();
    alert('Saved');
  });

  body.querySelector('#reset').addEventListener('click', () => {
    state.fs = structuredClone(defaultFS);
    saveFS();
    alert('Filesystem reset');
  });
}

function appBrowser(body) {
  body.innerHTML = `
    <div class="panel small">Lightweight browser (iframe). Some websites block embedding.</div>
    <div class="row"><input id="url" /><button id="go">Go</button></div>
    <iframe id="frame" title="browser" style="width:100%;height:360px;border:1px solid #334155;border-radius:0.5rem;margin-top:0.5rem;"></iframe>`;
  const url = body.querySelector('#url');
  const frame = body.querySelector('#frame');
  url.value = state.settings.homepage;
  frame.src = state.settings.homepage;
  body.querySelector('#go').addEventListener('click', () => {
    const value = url.value.startsWith('http') ? url.value : `https://${url.value}`;
    frame.src = value;
  });
}

function appEditor(body) {
  body.innerHTML = `
    <div class="panel small">LocalOS Script (LOS) keywords: PRINT "text", SET name "value".</div>
    <label>Script path
      <input id="path" value="/home/newscript.los" />
    </label>
    <textarea id="source">PRINT "My first LOS script"</textarea>
    <div class="row"><button id="save">Save</button><button id="run">Run</button></div>
    <pre class="terminal-output" id="preview"></pre>`;

  const pathInput = body.querySelector('#path');
  const source = body.querySelector('#source');
  const preview = body.querySelector('#preview');
  const print = (msg) => (preview.textContent += `${msg}\n`);

  body.querySelector('#save').addEventListener('click', () => {
    const path = resolvePath(pathInput.value.trim());
    const parent = dirname(path);
    if (!ensureDir(parent)) return alert('Invalid path');

    if (!state.fs[path]) state.fs[parent].children.push(basename(path));
    state.fs[path] = { type: 'file', kind: 'script', content: source.value };
    saveFS();
    alert('Script saved');
  });

  body.querySelector('#run').addEventListener('click', () => {
    preview.textContent = '';
    runLocalScript(source.value, print);
  });
}

const appRegistry = {
  terminal: ['Terminal', appTerminal],
  files: ['Files', appFiles],
  settings: ['Settings', appSettings],
  browser: ['Browser', appBrowser],
  editor: ['Script Editor', appEditor],
};

function wireDesktop() {
  document.querySelectorAll('.desktop-icon').forEach((btn) => {
    btn.addEventListener('click', () => {
      const [title, renderer] = appRegistry[btn.dataset.app];
      createWindow(title, renderer);
    });
  });

  const startBtn = document.getElementById('start-btn');
  const startMenu = document.getElementById('start-menu');
  const startSearch = document.getElementById('start-search');
  const startList = document.getElementById('start-list');

  const renderStartList = () => {
    const q = startSearch.value.trim().toLowerCase();
    startList.innerHTML = '';

    for (const [key, [title, renderer]] of Object.entries(appRegistry)) {
      if (q && !title.toLowerCase().includes(q)) continue;
      const item = document.createElement('button');
      item.className = 'start-item';
      item.textContent = title;
      item.addEventListener('click', () => {
        createWindow(title, renderer);
        startMenu.classList.add('hidden');
      });
      startList.appendChild(item);
    }
  };

  startBtn.addEventListener('click', () => {
    startMenu.classList.toggle('hidden');
    if (!startMenu.classList.contains('hidden')) startSearch.focus();
  });

  startSearch.addEventListener('input', renderStartList);
  document.addEventListener('click', (e) => {
    if (!startMenu.contains(e.target) && !startBtn.contains(e.target)) {
      startMenu.classList.add('hidden');
    }
  });

  renderStartList();
}

setInterval(() => {
  document.getElementById('clock').textContent = new Date().toLocaleTimeString();
}, 1000);

applyTheme(state.settings.theme);
wireDesktop();
