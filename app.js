const STORAGE_KEY = 'localos.fs.v1';
const SETTINGS_KEY = 'localos.settings.v1';

const defaultFS = {
  '/': { type: 'dir', children: ['home', 'apps', 'bin'] },
  '/home': { type: 'dir', children: ['readme.txt', 'hello.los'] },
  '/apps': { type: 'dir', children: ['about.app'] },
  '/bin': { type: 'dir', children: ['echo.exe'] },
  '/home/readme.txt': {
    type: 'file',
    kind: 'text',
    content: 'Welcome to LocalOS. Try terminal commands: help, ls /home, cat /home/readme.txt, run /home/hello.los',
  },
  '/home/hello.los': {
    type: 'file',
    kind: 'script',
    content: 'PRINT "Hello from LocalOS Script"\nSET name "friend"\nPRINT "Hi, $name"\n',
  },
  '/apps/about.app': { type: 'file', kind: 'app', content: 'about' },
  '/bin/echo.exe': { type: 'file', kind: 'exec', content: 'echo' },
};

const state = {
  fs: loadFS(),
  settings: loadSettings(),
  cwd: '/home'
};

function loadFS() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : structuredClone(defaultFS);
}

function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  return raw ? JSON.parse(raw) : { theme: 'dark', homepage: 'https://example.com' };
}

function saveFS() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.fs));
}

function resolvePath(path) {
  if (!path) return state.cwd;

  // absolute path
  if (path.startsWith('/')) return path;

  // ..
  if (path === '..') {
    const parts = state.cwd.split('/').filter(Boolean);
    parts.pop();
    return parts.length ? '/' + parts.join('/') : '/';
  }

  // .
  if (path === '.') return state.cwd;

  // relative
  return `${state.cwd === '/' ? '' : state.cwd}/${path}`;
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function createWindow(title, render) {
  const tpl = document.getElementById('window-template');
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.querySelector('.window-title').textContent = title;
  node.querySelector('.close').addEventListener('click', () => node.remove());
  const body = node.querySelector('.window-body');
  render(body);
  document.body.appendChild(node);
}

function childrenOf(path) {
  const item = state.fs[path];
  if (!item || item.type !== 'dir') return [];
  return item.children.map((name) => `${path === '/' ? '' : path}/${name}`);
}

function basename(path) {
  if (path === '/') return '/';
  return path.split('/').filter(Boolean).at(-1);
}

function parseArgs(raw) {
  return raw.match(/"[^"]*"|[^\s]+/g)?.map((x) => x.replace(/^"|"$/g, '')) ?? [];
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

function terminalCommand(input, stdout) {
  const [cmd, ...args] = parseArgs(input);
  const target = args[0];

  switch (cmd) {
    case 'help':
      stdout('Commands: help, ls [dir], cat <file>, write <file> <text>, mkdir <dir>, touch <file>, run <path>, exec <path>, clear, cd <dir>');
      break;
    case 'ls': {
      const path = resolvePath(target);
      const items = childrenOf(path);

      if (!state.fs[path] || state.fs[path].type !== 'dir') {
        stdout('directory not found');
        break;
      }

      stdout(
        items.length
          ? items.map((p) => `${basename(p)} (${state.fs[p].kind || state.fs[p].type})`).join('\n')
          : '(empty)'
      );
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
      const parts = path.split('/').filter(Boolean);
      const name = parts.pop();
      const parent = '/' + parts.join('/');

      if (!name || !state.fs[parent] || state.fs[parent].type !== 'dir') {
        stdout('invalid path');
        break;
      }

      const full = `${parent === '/' ? '' : parent}/${name}`;
      if (state.fs[full]) {
        stdout('exists');
        break;
      }

      state.fs[full] = { type: 'dir', children: [] };
      state.fs[parent].children.push(name);
      saveFS();
      stdout('directory created');
      break;
    }
    case 'touch': {
      const path = resolvePath(target);
      const parts = path.split('/').filter(Boolean);
      const name = parts.pop();
      const parent = '/' + parts.join('/');

      if (!name || !state.fs[parent] || state.fs[parent].type !== 'dir') {
        stdout('invalid path');
        break;
      }

      const full = `${parent === '/' ? '' : parent}/${name}`;
      if (state.fs[full]) {
        stdout('exists');
        break;
      }

      state.fs[full] = { type: 'file', kind: 'text', content: '' };
      state.fs[parent].children.push(name);
      saveFS();
      stdout('file created');
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
      return '__CLEAR__';
    default:
      stdout(`Unknown command: ${cmd || ''}`);
    case 'cls':
      return '__CLEAR__';
    case 'cd': {
      const path = resolvePath(target);

      if (!state.fs[path] || state.fs[path].type !== 'dir') {
        stdout('directory not found');
        break;
      }

      state.cwd = path;
      break;
    }
}}

function appTerminal(body) {
  body.innerHTML = `
    <div class="panel small">Debian-like terminal emulator using a virtual local filesystem. Data persists via localStorage.</div>
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
  print(`localos@machine:${state.cwd}$ help`);
  terminalCommand('help', print);

  const execute = () => {
    const cmd = input.value.trim();
    if (!cmd) return;
    print(`localos@machine:~$ ${cmd}`);
    const result = terminalCommand(cmd, print);
    if (result === '__CLEAR__') out.textContent = '';
    input.value = '';
  };

  body.querySelector('#term-run').addEventListener('click', execute);
  input.addEventListener('keydown', (e) => e.key === 'Enter' && execute());
}

function appFiles(body) {
  body.innerHTML = `
    <div class="panel">Virtual filesystem explorer</div>
    <ul class="file-list"></ul>`;
  const list = body.querySelector('.file-list');
  Object.keys(state.fs)
    .sort()
    .forEach((path) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${path}</span><span class="small">${state.fs[path].kind || state.fs[path].type}</span>`;
      list.appendChild(li);
    });
}

function appSettings(body) {
  body.innerHTML = `
    <div class="panel">
      <label>Theme
        <select id="theme"><option value="dark">Dark</option><option value="midnight">Midnight</option></select>
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

  body.querySelector('#save').addEventListener('click', () => {
    state.settings.theme = theme.value;
    state.settings.homepage = homepage.value;
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
    const path = pathInput.value.trim();
    const parts = path.split('/').filter(Boolean);
    const name = parts.pop();
    const parent = '/' + parts.join('/');
    if (!name || !state.fs[parent] || state.fs[parent].type !== 'dir') return alert('Invalid path');
    const full = `${parent === '/' ? '' : parent}/${name}`;
    if (!state.fs[full]) state.fs[parent].children.push(name);
    state.fs[full] = { type: 'file', kind: 'script', content: source.value };
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

document.querySelectorAll('.desktop-icon').forEach((btn) => {
  btn.addEventListener('click', () => {
    const [title, renderer] = appRegistry[btn.dataset.app];
    createWindow(title, renderer);
  });
});

setInterval(() => {
  document.getElementById('clock').textContent = new Date().toLocaleTimeString();
}, 1000);
