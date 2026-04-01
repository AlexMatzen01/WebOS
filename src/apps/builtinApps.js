import { LOSInterpreter } from '../los/interpreter.js';

export function registerBuiltinApps({ appRuntime, shell, processManager }) {
  appRuntime.register({ id: 'files', name: 'File Explorer', icon: '📁', permissions: ['fs.read', 'fs.write'], window: { width: 900, height: 560 } }, async (root, ctx) => {
    root.innerHTML = `<div class='toolbar'><input id='path' value='/home/guest'/><button id='up'>Up</button></div><div class='split'><ul id='tree'></ul><div><div id='meta'></div><pre id='preview'></pre></div></div>`;
    const tree = root.querySelector('#tree');
    const preview = root.querySelector('#preview');
    const meta = root.querySelector('#meta');
    async function load(path) {
      root.querySelector('#path').value = path;
      const entries = await ctx.fs.list(path);
      tree.innerHTML = '';
      for (const e of entries) {
        const li = document.createElement('li');
        li.textContent = `${e.type === 'dir' ? '📂' : '📄'} ${e.path.split('/').pop()}`;
        li.draggable = true;
        li.onclick = async () => {
          meta.textContent = `size=${e.size || 0} owner=${e.owner} perms=${JSON.stringify(e.permissions)}`;
          if (e.type === 'file') preview.textContent = await ctx.fs.readFile(e.path);
          if (e.type === 'dir') load(e.path);
        };
        tree.append(li);
      }
    }
    root.querySelector('#up').onclick = () => load(root.querySelector('#path').value.split('/').slice(0, -1).join('/') || '/');
    load('/home/guest');
  });

  appRuntime.register({ id: 'terminal', name: 'Terminal', icon: '🖥️', permissions: ['fs.read', 'fs.write', 'proc.read'], window: { width: 840, height: 520 } }, async (root) => {
    root.innerHTML = `<div class='tabs'><button id='newTab'>+</button></div><pre class='terminal-output' id='out'></pre><div class='row'><input id='cmd' placeholder='Type command...'/><button id='run'>Run</button></div>`;
    const out = root.querySelector('#out');
    const cmd = root.querySelector('#cmd');
    const exec = async () => {
      const line = cmd.value;
      out.textContent += `$ ${line}\n`;
      try {
        const res = await shell.run(line);
        out.textContent += res.output;
      } catch (e) {
        out.textContent += `error: ${e.message}\n`;
      }
      cmd.value = '';
      out.scrollTop = out.scrollHeight;
    };
    root.querySelector('#run').onclick = exec;
    cmd.addEventListener('keydown', (e) => e.key === 'Enter' && exec());
  });

  appRuntime.register({ id: 'editor', name: 'Text Editor', icon: '📝', permissions: ['fs.read', 'fs.write'], window: { width: 920, height: 600 } }, async (root, ctx) => {
    root.innerHTML = `<div class='row'><input id='file' value='/home/guest/script.los'/><button id='open'>Open</button><button id='save'>Save</button><button id='runLos'>Run LOS</button></div><textarea id='txt'></textarea><pre id='out'></pre>`;
    const txt = root.querySelector('#txt');
    const out = root.querySelector('#out');
    root.querySelector('#open').onclick = async () => txt.value = await ctx.fs.readFile(root.querySelector('#file').value).catch(() => '');
    root.querySelector('#save').onclick = async () => ctx.fs.writeFile(root.querySelector('#file').value, txt.value);
    root.querySelector('#runLos').onclick = async () => {
      const runtime = new LOSInterpreter(shell);
      try {
        const result = await runtime.run(txt.value);
        out.textContent = result.output.join('\n');
      } catch (e) {
        out.textContent = `LOS Error: ${e.message}`;
      }
    };
  });

  appRuntime.register({ id: 'browser', name: 'Browser', icon: '🌐', permissions: ['net.open'], window: { width: 980, height: 640 } }, async (root) => {
    root.innerHTML = `<div class='row'><input id='url' placeholder='https://example.com'/><button id='go'>Go</button></div><iframe id='view' sandbox='allow-same-origin allow-scripts allow-forms' referrerpolicy='no-referrer'></iframe>`;
    const url = root.querySelector('#url');
    const frame = root.querySelector('#view');
    root.querySelector('#go').onclick = () => {
      const value = url.value.startsWith('http') ? url.value : `https://${url.value}`;
      frame.src = value;
    };
  });

  appRuntime.register({ id: 'taskmgr', name: 'Task Manager', icon: '📊', permissions: ['proc.read', 'proc.kill'], window: { width: 700, height: 480 } }, async (root) => {
    root.innerHTML = `<table class='task-table'><thead><tr><th>PID</th><th>Name</th><th>State</th><th>CPU%</th><th>MEM MB</th><th></th></tr></thead><tbody id='rows'></tbody></table>`;
    const tbody = root.querySelector('#rows');
    const render = () => {
      tbody.innerHTML = '';
      for (const p of processManager.list()) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${p.pid}</td><td>${p.name}</td><td>${p.state}</td><td>${p.cpu}</td><td>${p.memory}</td><td><button data-pid='${p.pid}'>Kill</button></td>`;
        tr.querySelector('button').onclick = () => processManager.kill(p.pid);
        tbody.append(tr);
      }
    };
    render();
    setInterval(render, 1500);
  });
}
