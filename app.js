const STORAGE_KEY = 'localos.fs.v1';
const SETTINGS_KEY = 'localos.settings.v3';
const BROWSER_KEY = 'localos.browser.v1';
const NOTES_KEY = 'localos.notes.v1';
const TASKS_KEY = 'localos.tasks.v1';

const defaultFS = {
  '/': { type: 'dir', children: ['home', 'apps', 'bin', 'docs'] },
  '/home': { type: 'dir', children: ['readme.txt', 'hello.los', 'notes.txt'] },
  '/apps': { type: 'dir', children: ['about.app', 'sample.webapp', 'fs-tutorial.webapp'] },
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
  '/apps/sample.webapp': {
    type: 'file',
    kind: 'webapp',
    content: JSON.stringify({
      name: 'Sample Counter',
      entry: 'index.html',
      files: {
        'index.html': '<main><h2>Sample Counter</h2><p id="count">0</p><button id="inc">Increment</button><button id="save">Save to /home/counter.txt</button><pre id="log"></pre></main>',
        'styles.css': 'body{font-family:system-ui;background:#0f172a;color:#e2e8f0;padding:1rem}button{margin-right:.4rem}main{background:#1e293b;padding:1rem;border-radius:.6rem}',
        'app.js': "const countEl=document.getElementById('count');const log=(m)=>document.getElementById('log').textContent+=m+'\\n';let count=0;document.getElementById('inc').onclick=()=>{count++;countEl.textContent=String(count)};document.getElementById('save').onclick=async()=>{await LocalOS.fs.writeFile('/home/counter.txt',String(count));log('Saved count to /home/counter.txt');};",
      },
    }, null, 2),
  },
  '/apps/fs-tutorial.webapp': {
    type: 'file',
    kind: 'webapp',
    content: JSON.stringify({
      name: 'LocalOS FS API Tutorial',
      entry: 'index.html',
      files: {
        'index.html': '<main><h1>LocalOS File System API</h1><p>This tutorial app runs in the LocalOS web app sandbox.</p><ol><li><code>await LocalOS.fs.readFile(path)</code></li><li><code>await LocalOS.fs.writeFile(path, content)</code></li><li><code>await LocalOS.fs.listDir(path)</code></li><li><code>await LocalOS.fs.mkdir(path)</code></li><li><code>await LocalOS.fs.remove(path)</code></li></ol><button id="run">Run Demo</button><pre id="out"></pre></main>',
        'styles.css': 'body{font-family:Inter,system-ui;background:#020617;color:#e2e8f0;padding:1rem}main{max-width:760px}code{background:#1e293b;padding:.1rem .3rem;border-radius:.3rem}button{margin-top:.5rem}',
        'app.js': "const out=document.getElementById('out');const write=(t)=>out.textContent+=t+'\\n';document.getElementById('run').onclick=async()=>{write('Listing /home ...');write(JSON.stringify(await LocalOS.fs.listDir('/home'),null,2));write('Writing /home/tutorial-demo.txt ...');await LocalOS.fs.writeFile('/home/tutorial-demo.txt','Created by tutorial app');write(await LocalOS.fs.readFile('/home/tutorial-demo.txt'));};",
      },
    }, null, 2),
  },
  '/bin/echo.exe': { type: 'file', kind: 'exec', content: 'echo' },
};

const defaultSettings = {
  theme: 'dark',
  homepage: 'https://example.com',
  accentColor: '#22d3ee',
  wallpaper: 'Aurora',
  animations: true,
  autoSaveScripts: true,
  uiScale: 100,
  terminalFontSize: 14,
  clock24h: false,
  showSeconds: true,
  startupApp: 'terminal',
  windowOpacity: 95,
  cornerRadius: 12,
};
const defaultBrowserData = {
  bookmarks: [
    { name: 'Example', url: 'https://example.com' },
    { name: 'MDN', url: 'https://developer.mozilla.org' },
  ],
  scriptSnippets: [
    {
      name: 'Highlight links',
      code: "document.querySelectorAll('a').forEach((a) => (a.style.outline = '2px solid #22d3ee'));",
    },
  ],
};

const state = {
  fs: loadFS(),
  settings: loadSettings(),
  browserData: loadBrowserData(),
  notes: loadNotes(),
  tasks: loadTasks(),
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
  const parsed = raw ? JSON.parse(raw) : {};
  return { ...structuredClone(defaultSettings), ...parsed };
}

function saveFS() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.fs));
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function loadBrowserData() {
  const raw = localStorage.getItem(BROWSER_KEY);
  return raw ? JSON.parse(raw) : structuredClone(defaultBrowserData);
}

function saveBrowserData() {
  localStorage.setItem(BROWSER_KEY, JSON.stringify(state.browserData));
}

function loadNotes() {
  const raw = localStorage.getItem(NOTES_KEY);
  return raw ? JSON.parse(raw) : ['Welcome to Notes! Create quick ideas, plans, and drafts here.'];
}

function saveNotes() {
  localStorage.setItem(NOTES_KEY, JSON.stringify(state.notes));
}

function loadTasks() {
  const raw = localStorage.getItem(TASKS_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveTasks() {
  localStorage.setItem(TASKS_KEY, JSON.stringify(state.tasks));
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
    } else if (cmd === 'READ') {
      const path = resolvePath(rest[0]);
      const node = state.fs[path];
      stdout(node?.type === 'file' ? node.content : 'READ failed');
    } else if (cmd === 'WRITE') {
      const path = resolvePath(rest[0]);
      const text = rest.slice(1).join(' ');
      const parent = dirname(path);
      if (!ensureDir(parent)) {
        stdout('WRITE failed');
        continue;
      }
      if (!state.fs[path]) state.fs[parent].children.push(basename(path));
      state.fs[path] = { type: 'file', kind: state.fs[path]?.kind || 'text', content: text };
      saveFS();
      stdout('WRITE ok');
    } else if (cmd === 'LIST') {
      const path = resolvePath(rest[0]);
      if (!ensureDir(path)) stdout('LIST failed');
      else stdout(childrenOf(path).map((p) => basename(p)).join(', '));
    } else if (cmd === 'MKDIR') {
      const path = resolvePath(rest[0]);
      const parent = dirname(path);
      if (!ensureDir(parent) || state.fs[path]) stdout('MKDIR failed');
      else {
        state.fs[path] = { type: 'dir', children: [] };
        state.fs[parent].children.push(basename(path));
        saveFS();
        stdout('MKDIR ok');
      }
    } else if (cmd === 'DELETE') {
      const path = resolvePath(rest[0]);
      if (!removePath(path)) stdout('DELETE failed');
      else {
        saveFS();
        stdout('DELETE ok');
      }
    } else {
      stdout(`Unknown LOS command: ${cmd}`);
    }
  }
}

function parseWebApp(path) {
  const file = state.fs[path];
  if (!file || file.kind !== 'webapp') return null;
  try {
    const parsed = JSON.parse(file.content);
    if (!parsed.files || typeof parsed.files !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function buildWebAppDocument(bundle, runtimeId) {
  const html = bundle.files[bundle.entry || 'index.html'] || '<main>Missing entry file</main>';
  const css = bundle.files['styles.css'] || '';
  const js = bundle.files['app.js'] || '';
  const bridge = `
    <script>
      (() => {
        let seq = 0;
        const pending = new Map();
        function call(action, payload = {}) {
          return new Promise((resolve, reject) => {
            const id = 'req-' + (++seq);
            pending.set(id, { resolve, reject });
            parent.postMessage({ channel: 'localos-fs', runtimeId: '${runtimeId}', id, action, payload }, '*');
          });
        }
        window.addEventListener('message', (event) => {
          const data = event.data || {};
          if (data.channel !== 'localos-fs-response' || data.runtimeId !== '${runtimeId}') return;
          const wait = pending.get(data.id);
          if (!wait) return;
          pending.delete(data.id);
          if (data.error) wait.reject(new Error(data.error));
          else wait.resolve(data.result);
        });
        window.LocalOS = {
          fs: {
            readFile: (path) => call('readFile', { path }),
            writeFile: (path, content) => call('writeFile', { path, content }),
            listDir: (path) => call('listDir', { path }),
            mkdir: (path) => call('mkdir', { path }),
            remove: (path) => call('remove', { path }),
            exists: (path) => call('exists', { path }),
          }
        };
      })();
    </script>
  `;
  return `<!doctype html><html><head><meta charset="utf-8"/><style>${css}</style></head><body>${html}${bridge}<script>${js}<\/script></body></html>`;
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
      stdout('Commands: help, pwd, ls [dir], tree [dir], cd <dir>, cat <file>, write <file> <text>, mkdir <dir>, touch <file>, rm <path>, mv <src> <dst>, cp <src> <dst>, run <script>, openapp <webapp>, exec <binary>, date, whoami, clear');
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
    case 'openapp': {
      const path = resolvePath(target);
      if (!state.fs[path] || state.fs[path].kind !== 'webapp') {
        stdout('webapp not found');
        break;
      }
      createWindow(`Web App: ${basename(path)}`, (body) => appWebRunner(body, path));
      stdout(`opened ${path}`);
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
  document.body.dataset.wallpaper = state.settings.wallpaper || 'Aurora';
  document.body.dataset.animations = state.settings.animations ? 'on' : 'off';
  document.documentElement.style.setProperty('--accent', state.settings.accentColor || '#22d3ee');
  document.documentElement.style.setProperty('--terminal-font-size', `${state.settings.terminalFontSize || 14}px`);
  document.documentElement.style.setProperty('--window-opacity', `${(state.settings.windowOpacity ?? 95) / 100}`);
  document.documentElement.style.setProperty('--window-radius', `${state.settings.cornerRadius ?? 12}px`);
  document.documentElement.style.fontSize = `${Math.max(80, Math.min(130, Number(state.settings.uiScale) || 100))}%`;
  let node = document.getElementById('localos-custom-style');
  if (!node) {
    node = document.createElement('style');
    node.id = 'localos-custom-style';
    document.head.appendChild(node);
  }
  node.textContent = state.settings.customCSS || '';
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
      <label>Accent color
        <input id="accent-color" type="color" />
      </label>
      <label>Wallpaper preset
        <select id="wallpaper">
          <option value="Aurora">Aurora</option>
          <option value="Neon Grid">Neon Grid</option>
          <option value="Graphite">Graphite</option>
          <option value="Sunset Lake">Sunset Lake</option>
        </select>
      </label>
      <label>Startup app
        <select id="startup-app">
          <option value="terminal">Terminal</option>
          <option value="files">Files</option>
          <option value="settings">Settings</option>
          <option value="customize">Customizer</option>
          <option value="browser">Browser</option>
          <option value="editor">Script Editor</option>
          <option value="studio">App Studio</option>
          <option value="runner">Web App Runner</option>
          <option value="tutorial">FS API Tutorial</option>
          <option value="notes">Notes</option>
          <option value="tasks">Task Board</option>
          <option value="calculator">Calculator</option>
        </select>
      </label>
      <label>UI scale
        <input id="ui-scale" type="range" min="80" max="130" step="5" />
      </label>
      <label>Terminal font size
        <input id="terminal-font" type="range" min="12" max="22" step="1" />
      </label>
      <label><input type="checkbox" id="clock-24h" /> Use 24-hour clock</label>
      <label><input type="checkbox" id="show-seconds" /> Show seconds in clock</label>
      <label><input type="checkbox" id="animations" /> Enable animations</label>
      <label><input type="checkbox" id="autosave-scripts" /> Auto-save scripts in editor</label>
      <div class="row"><button id="save">Save Settings</button><button id="reset">Reset Filesystem</button><button id="defaults">Restore Defaults</button></div>
    </div>`;

  const theme = body.querySelector('#theme');
  const homepage = body.querySelector('#homepage');
  const accentColor = body.querySelector('#accent-color');
  const wallpaper = body.querySelector('#wallpaper');
  const startupApp = body.querySelector('#startup-app');
  const uiScale = body.querySelector('#ui-scale');
  const terminalFont = body.querySelector('#terminal-font');
  const clock24h = body.querySelector('#clock-24h');
  const showSeconds = body.querySelector('#show-seconds');
  const animations = body.querySelector('#animations');
  const autosaveScripts = body.querySelector('#autosave-scripts');
  theme.value = state.settings.theme;
  homepage.value = state.settings.homepage;
  accentColor.value = state.settings.accentColor;
  wallpaper.value = state.settings.wallpaper;
  startupApp.value = state.settings.startupApp;
  uiScale.value = state.settings.uiScale;
  terminalFont.value = state.settings.terminalFontSize;
  clock24h.checked = state.settings.clock24h;
  showSeconds.checked = state.settings.showSeconds;
  animations.checked = state.settings.animations;
  autosaveScripts.checked = state.settings.autoSaveScripts;

  theme.addEventListener('change', () => applyTheme(theme.value));

  body.querySelector('#save').addEventListener('click', () => {
    state.settings.theme = theme.value;
    state.settings.homepage = homepage.value;
    state.settings.accentColor = accentColor.value;
    state.settings.wallpaper = wallpaper.value;
    state.settings.startupApp = startupApp.value;
    state.settings.uiScale = Number(uiScale.value);
    state.settings.terminalFontSize = Number(terminalFont.value);
    state.settings.clock24h = clock24h.checked;
    state.settings.showSeconds = showSeconds.checked;
    state.settings.animations = animations.checked;
    state.settings.autoSaveScripts = autosaveScripts.checked;
    applyTheme(theme.value);
    saveSettings();
    alert('Saved');
  });

  body.querySelector('#reset').addEventListener('click', () => {
    state.fs = structuredClone(defaultFS);
    saveFS();
    alert('Filesystem reset');
  });

  body.querySelector('#defaults').addEventListener('click', () => {
    state.settings = structuredClone(defaultSettings);
    applyTheme(state.settings.theme);
    saveSettings();
    alert('Defaults restored. Reopen settings to view reset values.');
  });
}

function appBrowser(body) {
  body.innerHTML = `
    <div class="panel small">
      Advanced browser controller (no iframes): each tab opens in a real browser window so sites that block framing can still load normally.
    </div>
    <div class="browser-shell">
      <div class="browser-toolbar">
        <div class="row">
          <button id="new-tab">New Tab</button>
          <button id="close-tab">Close Tab</button>
          <button id="focus-tab">Focus Tab</button>
          <button id="refresh-tab">Refresh</button>
        </div>
        <div class="row">
          <input id="url-input" placeholder="Enter URL or hostname" />
          <button id="go-btn">Go</button>
          <button id="back-btn">Back</button>
          <button id="forward-btn">Forward</button>
        </div>
        <div class="row">
          <button id="bookmark-btn">Bookmark</button>
          <select id="bookmark-list"></select>
          <button id="open-bookmark">Open Bookmark</button>
        </div>
      </div>
      <div class="browser-layout">
        <div class="browser-sidebar panel">
          <strong>Tabs</strong>
          <ul id="tab-list" class="file-list compact"></ul>
          <strong>Recent History</strong>
          <ul id="history-list" class="file-list compact"></ul>
        </div>
        <div class="browser-main">
          <div class="panel">
            <div class="row">
              <input id="snippet-name" placeholder="Snippet name" />
              <button id="save-snippet">Save Snippet</button>
              <select id="snippet-list"></select>
              <button id="load-snippet">Load</button>
            </div>
            <label>JavaScript Injection
              <textarea id="inject-code" placeholder="console.log('hello from LocalOS browser controller')"></textarea>
            </label>
            <div class="row">
              <button id="inject-direct">Inject (same-origin)</button>
              <button id="inject-bookmarklet">Inject via bookmarklet</button>
            </div>
            <div class="small">
              Direct injection works when tab access is same-origin. Bookmarklet injection attempts to run in any focused tab (subject to browser security/CSP).
            </div>
          </div>
          <pre class="terminal-output" id="browser-log"></pre>
        </div>
      </div>
    </div>`;

  const tabs = [];
  const history = [];
  let activeTabId = null;
  let tabCounter = 0;

  const urlInput = body.querySelector('#url-input');
  const tabList = body.querySelector('#tab-list');
  const historyList = body.querySelector('#history-list');
  const snippetList = body.querySelector('#snippet-list');
  const injectCode = body.querySelector('#inject-code');
  const bookmarkList = body.querySelector('#bookmark-list');
  const browserLog = body.querySelector('#browser-log');
  const snippetName = body.querySelector('#snippet-name');

  const log = (line) => {
    browserLog.textContent += `${line}\n`;
    browserLog.scrollTop = browserLog.scrollHeight;
  };

  const toUrl = (value) => {
    if (!value) return state.settings.homepage;
    if (value.startsWith('http://') || value.startsWith('https://')) return value;
    return `https://${value}`;
  };

  const renderBookmarkList = () => {
    bookmarkList.innerHTML = '';
    for (const bookmark of state.browserData.bookmarks) {
      const option = document.createElement('option');
      option.value = bookmark.url;
      option.textContent = `${bookmark.name} — ${bookmark.url}`;
      bookmarkList.appendChild(option);
    }
  };

  const renderSnippets = () => {
    snippetList.innerHTML = '';
    for (const snippet of state.browserData.scriptSnippets) {
      const option = document.createElement('option');
      option.value = snippet.name;
      option.textContent = snippet.name;
      snippetList.appendChild(option);
    }
  };

  const getActiveTab = () => tabs.find((tab) => tab.id === activeTabId);

  const renderTabs = () => {
    tabList.innerHTML = '';
    for (const tab of tabs) {
      const li = document.createElement('li');
      li.className = tab.id === activeTabId ? 'active-tab' : '';
      li.innerHTML = `<span>${tab.title}</span><span class="small">${tab.url}</span>`;
      li.addEventListener('click', () => {
        activeTabId = tab.id;
        urlInput.value = tab.url;
        renderTabs();
      });
      tabList.appendChild(li);
    }
  };

  const renderHistory = () => {
    historyList.innerHTML = '';
    for (const entry of history.slice(-15).reverse()) {
      const li = document.createElement('li');
      li.innerHTML = `<span>${entry.title}</span><span class="small">${entry.url}</span>`;
      li.addEventListener('click', () => {
        openInTab(entry.url);
      });
      historyList.appendChild(li);
    }
  };

  const markVisited = (tab, url) => {
    tab.url = url;
    history.push({ title: tab.title, url, visitedAt: Date.now() });
    if (history.length > 250) history.shift();
    renderTabs();
    renderHistory();
  };

  const openTabWindow = (url) => {
    const win = window.open(url, '_blank', 'noopener');
    if (!win) {
      log('Popup blocked. Allow popups for LocalOS to use advanced browser tabs.');
      return null;
    }
    return win;
  };

  const createTab = (targetUrl = state.settings.homepage) => {
    const url = toUrl(targetUrl);
    const external = openTabWindow(url);
    if (!external) return;

    const tab = {
      id: `tab-${++tabCounter}`,
      title: `Tab ${tabCounter}`,
      window: external,
      url,
      backStack: [],
      forwardStack: [],
    };
    tabs.push(tab);
    activeTabId = tab.id;
    markVisited(tab, url);
    urlInput.value = url;
    renderTabs();
    log(`Opened ${url} in ${tab.title}`);
  };

  const openInTab = (targetUrl) => {
    const url = toUrl(targetUrl || urlInput.value.trim());
    const tab = getActiveTab();
    if (!tab) return createTab(url);

    if (tab.url && tab.url !== url) tab.backStack.push(tab.url);
    tab.forwardStack = [];
    if (tab.window?.closed) tab.window = openTabWindow(url);
    else tab.window.location.href = url;
    markVisited(tab, url);
    urlInput.value = url;
    log(`Navigated ${tab.title} to ${url}`);
  };

  const tryDirectInjection = () => {
    const tab = getActiveTab();
    if (!tab) return log('No active tab');
    const script = injectCode.value.trim();
    if (!script) return log('No script to inject');

    try {
      const result = tab.window.eval(script);
      log(`Direct injection succeeded: ${String(result)}`);
    } catch (error) {
      log(`Direct injection failed: ${error.message}`);
    }
  };

  const injectViaBookmarklet = () => {
    const tab = getActiveTab();
    if (!tab) return log('No active tab');
    const script = injectCode.value.trim();
    if (!script) return log('No script to inject');

    try {
      const payload = encodeURIComponent(script);
      tab.window.location.href = `javascript:(()=>{${decodeURIComponent(payload)}})();void 0;`;
      log('Bookmarklet injection command sent.');
    } catch (error) {
      log(`Bookmarklet injection failed: ${error.message}`);
    }
  };

  body.querySelector('#new-tab').addEventListener('click', () => createTab(urlInput.value.trim() || state.settings.homepage));
  body.querySelector('#close-tab').addEventListener('click', () => {
    const tab = getActiveTab();
    if (!tab) return;
    if (tab.window && !tab.window.closed) tab.window.close();
    const idx = tabs.findIndex((x) => x.id === tab.id);
    tabs.splice(idx, 1);
    activeTabId = tabs[0]?.id ?? null;
    renderTabs();
    log(`Closed ${tab.title}`);
  });
  body.querySelector('#focus-tab').addEventListener('click', () => {
    const tab = getActiveTab();
    if (!tab) return;
    tab.window?.focus();
    log(`Focused ${tab.title}`);
  });
  body.querySelector('#refresh-tab').addEventListener('click', () => {
    const tab = getActiveTab();
    if (!tab) return;
    tab.window?.location?.reload();
    log(`Refreshed ${tab.title}`);
  });
  body.querySelector('#go-btn').addEventListener('click', () => openInTab(urlInput.value.trim()));
  urlInput.addEventListener('keydown', (e) => e.key === 'Enter' && openInTab(urlInput.value.trim()));
  body.querySelector('#back-btn').addEventListener('click', () => {
    const tab = getActiveTab();
    if (!tab || !tab.backStack.length) return;
    const previous = tab.backStack.pop();
    tab.forwardStack.push(tab.url);
    openInTab(previous);
  });
  body.querySelector('#forward-btn').addEventListener('click', () => {
    const tab = getActiveTab();
    if (!tab || !tab.forwardStack.length) return;
    const next = tab.forwardStack.pop();
    tab.backStack.push(tab.url);
    openInTab(next);
  });
  body.querySelector('#bookmark-btn').addEventListener('click', () => {
    const tab = getActiveTab();
    if (!tab) return;
    const name = prompt('Bookmark name?', tab.title) || tab.title;
    state.browserData.bookmarks.push({ name, url: tab.url });
    saveBrowserData();
    renderBookmarkList();
    log(`Bookmarked ${tab.url}`);
  });
  body.querySelector('#open-bookmark').addEventListener('click', () => openInTab(bookmarkList.value));
  body.querySelector('#save-snippet').addEventListener('click', () => {
    const code = injectCode.value.trim();
    if (!code) return log('No snippet code to save');
    const name = snippetName.value.trim() || `Snippet ${state.browserData.scriptSnippets.length + 1}`;
    state.browserData.scriptSnippets.push({ name, code });
    saveBrowserData();
    renderSnippets();
    snippetName.value = '';
    log(`Saved snippet "${name}"`);
  });
  body.querySelector('#load-snippet').addEventListener('click', () => {
    const snippet = state.browserData.scriptSnippets.find((x) => x.name === snippetList.value);
    if (!snippet) return;
    injectCode.value = snippet.code;
    log(`Loaded snippet "${snippet.name}"`);
  });
  body.querySelector('#inject-direct').addEventListener('click', tryDirectInjection);
  body.querySelector('#inject-bookmarklet').addEventListener('click', injectViaBookmarklet);

  renderBookmarkList();
  renderSnippets();
  injectCode.value = state.browserData.scriptSnippets[0]?.code ?? '';
  createTab(state.settings.homepage);
}

function appEditor(body) {
  body.innerHTML = `
    <div class="panel small">LocalOS Script (LOS) keywords: PRINT, SET, READ, WRITE, LIST, MKDIR, DELETE.</div>
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
    if (state.settings.autoSaveScripts) body.querySelector('#save').click();
    runLocalScript(source.value, print);
  });
}

function appNotes(body) {
  body.innerHTML = `
    <div class="panel small">Simple persistent note cards for quick ideas.</div>
    <div class="row">
      <button id="add-note">Add Note</button>
      <button id="save-notes">Save All</button>
    </div>
    <div id="notes-wrap"></div>`;

  const wrap = body.querySelector('#notes-wrap');

  const render = () => {
    wrap.innerHTML = '';
    state.notes.forEach((value, index) => {
      const row = document.createElement('div');
      row.className = 'panel';
      row.innerHTML = `
        <label>Note ${index + 1}
          <textarea data-note="${index}">${value}</textarea>
        </label>
        <div class="row"><button data-remove="${index}">Delete</button></div>`;
      wrap.appendChild(row);
    });
  };

  body.querySelector('#add-note').addEventListener('click', () => {
    state.notes.push('');
    render();
  });

  body.querySelector('#save-notes').addEventListener('click', () => {
    body.querySelectorAll('textarea[data-note]').forEach((el) => {
      state.notes[Number(el.dataset.note)] = el.value;
    });
    saveNotes();
    alert('Notes saved');
  });

  wrap.addEventListener('click', (event) => {
    if (!event.target.matches('button[data-remove]')) return;
    const idx = Number(event.target.dataset.remove);
    state.notes.splice(idx, 1);
    saveNotes();
    render();
  });

  render();
}

function appTasks(body) {
  body.innerHTML = `
    <div class="panel small">Task board with status tracking and due dates.</div>
    <div class="row">
      <input id="task-title" placeholder="New task title" />
      <input id="task-due" type="date" />
      <button id="add-task">Add Task</button>
    </div>
    <ul id="task-list" class="file-list"></ul>`;

  const list = body.querySelector('#task-list');
  const titleInput = body.querySelector('#task-title');
  const dueInput = body.querySelector('#task-due');

  const render = () => {
    list.innerHTML = '';
    for (const [index, task] of state.tasks.entries()) {
      const item = document.createElement('li');
      item.innerHTML = `
        <span>${task.title} ${task.due ? `(due ${task.due})` : ''}</span>
        <div>
          <select data-status="${index}">
            <option value="todo">Todo</option>
            <option value="doing">Doing</option>
            <option value="done">Done</option>
          </select>
          <button data-delete="${index}">✕</button>
        </div>`;
      item.querySelector('select').value = task.status;
      list.appendChild(item);
    }
  };

  body.querySelector('#add-task').addEventListener('click', () => {
    const title = titleInput.value.trim();
    if (!title) return;
    state.tasks.push({ title, due: dueInput.value, status: 'todo' });
    titleInput.value = '';
    dueInput.value = '';
    saveTasks();
    render();
  });

  list.addEventListener('change', (event) => {
    if (!event.target.matches('select[data-status]')) return;
    const idx = Number(event.target.dataset.status);
    state.tasks[idx].status = event.target.value;
    saveTasks();
  });

  list.addEventListener('click', (event) => {
    if (!event.target.matches('button[data-delete]')) return;
    const idx = Number(event.target.dataset.delete);
    state.tasks.splice(idx, 1);
    saveTasks();
    render();
  });

  render();
}

function appCalculator(body) {
  body.innerHTML = `
    <div class="panel small">Quick calculator with expression history.</div>
    <label>Expression
      <input id="calc-input" placeholder="(12 + 8) * 3 / 2" />
    </label>
    <div class="row"><button id="calc-run">Calculate</button><button id="calc-clear">Clear History</button></div>
    <pre class="terminal-output" id="calc-history"></pre>`;

  const input = body.querySelector('#calc-input');
  const history = body.querySelector('#calc-history');

  const append = (line) => {
    history.textContent += `${line}\n`;
  };

  body.querySelector('#calc-run').addEventListener('click', () => {
    const expr = input.value.trim();
    if (!expr) return;
    try {
      const result = Function(`"use strict"; return (${expr})`)();
      append(`${expr} = ${result}`);
    } catch (error) {
      append(`${expr} -> Error: ${error.message}`);
    }
    input.value = '';
  });

  body.querySelector('#calc-clear').addEventListener('click', () => {
    history.textContent = '';
  });
}

function appCustomizer(body) {
  body.innerHTML = `
    <div class="panel small">Advanced UI customization controls for LocalOS appearance.</div>
    <label>Window opacity (%)
      <input id="win-opacity" type="range" min="70" max="100" step="1" />
    </label>
    <label>Window corner radius (px)
      <input id="corner-radius" type="range" min="6" max="24" step="1" />
    </label>
    <label>Custom CSS (applies globally)
      <textarea id="custom-css" placeholder="Example: .desktop-icon { text-transform: uppercase; }"></textarea>
    </label>
    <div class="row"><button id="apply">Apply</button><button id="clear-css">Clear CSS</button></div>`;

  const winOpacity = body.querySelector('#win-opacity');
  const cornerRadius = body.querySelector('#corner-radius');
  const customCss = body.querySelector('#custom-css');
  winOpacity.value = state.settings.windowOpacity ?? 95;
  cornerRadius.value = state.settings.cornerRadius ?? 12;
  customCss.value = state.settings.customCSS || '';

  const applyCustomCss = () => {
    let node = document.getElementById('localos-custom-style');
    if (!node) {
      node = document.createElement('style');
      node.id = 'localos-custom-style';
      document.head.appendChild(node);
    }
    node.textContent = state.settings.customCSS || '';
  };

  body.querySelector('#apply').addEventListener('click', () => {
    state.settings.windowOpacity = Number(winOpacity.value);
    state.settings.cornerRadius = Number(cornerRadius.value);
    state.settings.customCSS = customCss.value;
    document.documentElement.style.setProperty('--window-opacity', `${state.settings.windowOpacity / 100}`);
    document.documentElement.style.setProperty('--window-radius', `${state.settings.cornerRadius}px`);
    applyCustomCss();
    saveSettings();
    alert('Customization applied');
  });

  body.querySelector('#clear-css').addEventListener('click', () => {
    customCss.value = '';
    state.settings.customCSS = '';
    applyCustomCss();
    saveSettings();
  });
}

function appStudio(body) {
  body.innerHTML = `
    <div class="panel small">Create LocalOS web apps using HTML, CSS, and JavaScript. Save as .webapp files in /apps.</div>
    <label>App path
      <input id="studio-path" value="/apps/new-app.webapp" />
    </label>
    <label>HTML (index.html)<textarea id="studio-html"><main><h2>Hello LocalOS App</h2><button id="ping">Ping FS</button><pre id="log"></pre></main></textarea></label>
    <label>CSS (styles.css)<textarea id="studio-css">body{font-family:system-ui;background:#111827;color:#f8fafc;padding:1rem}</textarea></label>
    <label>JavaScript (app.js)<textarea id="studio-js">document.getElementById('ping').onclick=async()=>{const data=await LocalOS.fs.listDir('/home');document.getElementById('log').textContent=JSON.stringify(data,null,2);};</textarea></label>
    <div class="row"><button id="studio-save">Save App</button><button id="studio-run">Run Preview</button></div>`;

  const pathInput = body.querySelector('#studio-path');
  const htmlInput = body.querySelector('#studio-html');
  const cssInput = body.querySelector('#studio-css');
  const jsInput = body.querySelector('#studio-js');

  const saveBundle = () => {
    const path = resolvePath(pathInput.value.trim());
    const parent = dirname(path);
    if (!ensureDir(parent)) return alert('Invalid app path');
    const bundle = { name: basename(path), entry: 'index.html', files: { 'index.html': htmlInput.value, 'styles.css': cssInput.value, 'app.js': jsInput.value } };
    if (!state.fs[path]) state.fs[parent].children.push(basename(path));
    state.fs[path] = { type: 'file', kind: 'webapp', content: JSON.stringify(bundle, null, 2) };
    saveFS();
    return path;
  };

  body.querySelector('#studio-save').addEventListener('click', () => {
    const path = saveBundle();
    if (path) alert(`Saved ${path}`);
  });
  body.querySelector('#studio-run').addEventListener('click', () => {
    const path = saveBundle();
    if (!path) return;
    createWindow(`Preview: ${basename(path)}`, (previewBody) => appWebRunner(previewBody, path));
  });
}

function appFsTutorial(body) {
  appWebRunner(body, '/apps/fs-tutorial.webapp');
}

function appWebRunner(body, initialPath = '/apps/sample.webapp') {
  body.innerHTML = `
    <div class="panel small">Run LocalOS web apps with the LocalOS.fs API bridge.</div>
    <div class="row">
      <input id="webapp-path" value="${initialPath}" />
      <button id="webapp-load">Load</button>
      <button id="webapp-refresh">Reload</button>
    </div>
    <iframe id="webapp-frame" title="LocalOS Web App Runtime" sandbox="allow-scripts" style="width:100%;height:58vh;border:1px solid #334155;border-radius:.5rem;"></iframe>
    <pre class="terminal-output" id="webapp-log"></pre>`;

  const pathInput = body.querySelector('#webapp-path');
  const frame = body.querySelector('#webapp-frame');
  const logEl = body.querySelector('#webapp-log');
  const runtimeId = `runtime-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  frame.dataset.runtimeId = runtimeId;

  const log = (msg) => {
    logEl.textContent += `${msg}\n`;
  };

  const loadApp = () => {
    const path = resolvePath(pathInput.value.trim());
    const bundle = parseWebApp(path);
    if (!bundle) return log(`Invalid web app bundle: ${path}`);
    frame.srcdoc = buildWebAppDocument(bundle, runtimeId);
    log(`Loaded ${path}`);
  };

  body.querySelector('#webapp-load').addEventListener('click', loadApp);
  body.querySelector('#webapp-refresh').addEventListener('click', loadApp);
  loadApp();
}

window.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.channel !== 'localos-fs') return;
  const send = (result, error = null) => {
    event.source?.postMessage({ channel: 'localos-fs-response', runtimeId: data.runtimeId, id: data.id, result, error }, '*');
  };
  try {
    const path = resolvePath(data.payload?.path || '/');
    if (data.action === 'readFile') {
      const node = state.fs[path];
      if (!node || node.type !== 'file') return send(null, 'File not found');
      return send(node.content);
    }
    if (data.action === 'writeFile') {
      const parent = dirname(path);
      if (!ensureDir(parent)) return send(null, 'Invalid parent directory');
      if (!state.fs[path]) state.fs[parent].children.push(basename(path));
      state.fs[path] = { type: 'file', kind: state.fs[path]?.kind || 'text', content: String(data.payload?.content ?? '') };
      saveFS();
      return send(true);
    }
    if (data.action === 'listDir') {
      if (!ensureDir(path)) return send(null, 'Directory not found');
      return send(childrenOf(path).map((p) => ({ name: basename(p), type: state.fs[p].type, kind: state.fs[p].kind || state.fs[p].type, path: p })));
    }
    if (data.action === 'mkdir') {
      const parent = dirname(path);
      if (!ensureDir(parent) || state.fs[path]) return send(null, 'Cannot create directory');
      state.fs[path] = { type: 'dir', children: [] };
      state.fs[parent].children.push(basename(path));
      saveFS();
      return send(true);
    }
    if (data.action === 'remove') {
      if (!removePath(path)) return send(null, 'Path not found');
      saveFS();
      return send(true);
    }
    if (data.action === 'exists') return send(Boolean(state.fs[path]));
    return send(null, 'Unknown action');
  } catch (error) {
    return send(null, error.message);
  }
});

const appRegistry = {
  terminal: ['Terminal', appTerminal],
  files: ['Files', appFiles],
  settings: ['Settings', appSettings],
  customize: ['Customizer', appCustomizer],
  browser: ['Browser', appBrowser],
  editor: ['Script Editor', appEditor],
  studio: ['App Studio', appStudio],
  runner: ['Web App Runner', (body) => appWebRunner(body, '/apps/sample.webapp')],
  tutorial: ['FS API Tutorial', appFsTutorial],
  notes: ['Notes', appNotes],
  tasks: ['Task Board', appTasks],
  calculator: ['Calculator', appCalculator],
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
  const now = new Date();
  document.getElementById('clock').textContent = now.toLocaleTimeString([], {
    hour12: !state.settings.clock24h,
    second: state.settings.showSeconds ? '2-digit' : undefined,
    minute: '2-digit',
    hour: '2-digit',
  });
}, 1000);

applyTheme(state.settings.theme);
wireDesktop();

if (appRegistry[state.settings.startupApp]) {
  const [title, renderer] = appRegistry[state.settings.startupApp];
  createWindow(title, renderer);
}
