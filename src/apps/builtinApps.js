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
    root.innerHTML = `
      <div class='terminal-app'>
        <div class='terminal-topbar'>
          <div class='terminal-title'>LocalOS Shell</div>
          <div class='terminal-actions'>
            <button data-snippet='help'>help</button>
            <button data-snippet='ls'>ls</button>
            <button data-snippet='tree'>tree</button>
            <button data-snippet='ps'>ps</button>
            <button id='clearView'>clear view</button>
          </div>
        </div>
        <pre class='terminal-output' id='out'></pre>
        <div class='terminal-status'>
          <span id='cwdPill'></span>
          <span id='codePill'>exit: 0</span>
        </div>
        <div class='terminal-cli'>
          <span id='prompt'></span>
          <input id='cmd' spellcheck='false' placeholder='Type command, ↑/↓ history, Tab autocomplete' />
        </div>
      </div>`;
    const out = root.querySelector('#out');
    const cmd = root.querySelector('#cmd');
    const prompt = root.querySelector('#prompt');
    const cwdPill = root.querySelector('#cwdPill');
    const codePill = root.querySelector('#codePill');
    let historyIndex = shell.history.length;

    const redrawPrompt = () => {
      prompt.textContent = `${shell.prompt()} `;
      cwdPill.textContent = shell.cwd;
    };
    const print = (line = '') => {
      if (line === '\u001b[2J\u001b[H') {
        out.textContent = '';
        return;
      }
      out.textContent += line;
      out.scrollTop = out.scrollHeight;
    };

    const exec = async () => {
      const line = cmd.value;
      if (!line.trim()) return;
      print(`${shell.prompt()} ${line}\n`);
      try {
        const res = await shell.run(line);
        print(res.output);
        codePill.textContent = `exit: ${res.code}`;
      } catch (e) {
        print(`error: ${e.message}\n`);
        codePill.textContent = 'exit: 1';
      }
      cmd.value = '';
      historyIndex = shell.history.length;
      redrawPrompt();
    };

    cmd.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        await exec();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (historyIndex <= 0) return;
        historyIndex--;
        cmd.value = shell.history[historyIndex] || '';
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex >= shell.history.length) return;
        historyIndex++;
        cmd.value = shell.history[historyIndex] || '';
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const tokens = cmd.value.trim().split(/\s+/);
        const needle = tokens[tokens.length - 1] || '';
        const commandMatches = [...shell.commands.keys()].filter((name) => name.startsWith(needle));
        if (tokens.length === 1 && commandMatches.length === 1) {
          cmd.value = `${commandMatches[0]} `;
          return;
        }
        try {
          const entries = await shell.vfs.list(shell.cwd);
          const fileMatches = entries.map((e) => e.path.split('/').pop()).filter((name) => name.startsWith(needle));
          if (fileMatches.length === 1) {
            tokens[tokens.length - 1] = fileMatches[0];
            cmd.value = `${tokens.join(' ')} `;
          } else if (fileMatches.length > 1) {
            print(`${fileMatches.join('    ')}\n`);
          } else if (commandMatches.length > 1) {
            print(`${commandMatches.join('    ')}\n`);
          }
        } catch {}
      }
    });

    root.querySelector('#clearView').onclick = () => {
      out.textContent = '';
      cmd.focus();
    };
    root.querySelectorAll('[data-snippet]').forEach((button) => {
      button.onclick = () => {
        cmd.value = button.dataset.snippet || '';
        cmd.focus();
      };
    });
    redrawPrompt();
    print('Welcome to LocalOS shell. Run `help` to view available commands.\n');
    print(`Session started at ${new Date().toLocaleTimeString()}.\n\n`);
    cmd.focus();
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

  appRuntime.register({ 
  id: 'appstudio', name: 'App Studio', icon: '🧪', 
  permissions: ['fs.read', 'fs.write'], 
  window: { width: 1100, height: 700 } 
}, async (root, ctx) => {
  root.innerHTML = `
    <div class='row'>
      <input id='projectPath' value='/home/guest/apps/my-first-app.localapp.json' />
      <button id='newProject'>New</button>
      <button id='loadProject'>Load</button>
      <button id='saveProject'>Save</button>
      <button id='runPreview'>Run Preview</button>
      <button id='installApp'>Install to LocalOS</button>
    </div>
    <div class='row' style='margin-top:.5rem'>
      <input id='appId' placeholder='app id (my-first-app)' />
      <input id='appName' placeholder='App name' />
      <input id='appIcon' value='🧩' placeholder='Icon' style='max-width:120px' />
      <input id='appWidth' type='number' value='900' min='380' placeholder='Width' style='max-width:110px' />
      <input id='appHeight' type='number' value='620' min='260' placeholder='Height' style='max-width:110px' />
      <label><input id='addDesktopShortcut' type='checkbox' /> Add to desktop</label>
    </div>
    <div class='row' style='margin-top:.5rem'>
      <input id='assetName' placeholder='Asset key (logo, ding, etc)' />
      <input id='assetUrl' placeholder='Asset URL or data URL' />
      <button id='addAsset'>Add Asset</button>
    </div>
    <div class='split' style='margin-top:.7rem'>
      <div>
        <label>HTML</label>
        <textarea id='htmlEditor'></textarea>
        <label>CSS</label>
        <textarea id='cssEditor'></textarea>
      </div>
      <div>
        <label>JavaScript</label>
        <textarea id='jsEditor'></textarea>
        <div class='row' style='margin-top:.5rem'>
          <button id='insertExample'>Insert LocalOS API Example</button>
        </div>
        <p style='margin:.5rem 0'>Assets</p>
        <pre id='assetsPreview'></pre>
        <p style='margin:.5rem 0'>Console</p>
        <pre id='studioLog' class='terminal-output' style='min-height:180px'></pre>
      </div>
    </div>
    <iframe id='previewFrame' sandbox='allow-scripts'></iframe>
  `;

  const defaults = () => ({
    id: 'my-first-app',
    name: 'My LocalOS App',
    icon: '🧩',
    window: { width: 900, height: 620 },
    html: '<main><h1>Hello from App Studio</h1><p id="status">Ready.</p><button id="save">Write to LocalOS</button><img id="logo" style="max-width:160px;display:none" /></main>',
    css: 'body{font-family:Inter,system-ui;background:#020617;color:#e2e8f0;padding:1rem}main{background:#0f172a;border:1px solid #334155;border-radius:.75rem;padding:1rem}button{margin-top:.6rem}',
    js: `
(async () => {
  const status = document.getElementById('status');
  const log = (...msg) => parent.postMessage({ type: 'localos-log', message: msg.join(' ') }, '*');
  document.getElementById('save').onclick = async () => {
    await LocalOS.fs.writeFile('/home/guest/Documents/studio-output.txt', 'Saved from App Studio');
    status.textContent = 'Saved /home/guest/Documents/studio-output.txt';
    log('Saved file to LocalOS VFS');
  };

  try {
    const logoUrl = await LocalOS.assets.getUrl('logo');
    if (logoUrl) {
      const logo = document.getElementById('logo');
      logo.src = logoUrl;
      logo.style.display = 'block';
    }
  } catch(e) {
    log('Logo asset missing');
  }
})();
    `,
    assets: {},
  });

  let project = defaults();

  const htmlEditor = root.querySelector('#htmlEditor');
  const cssEditor = root.querySelector('#cssEditor');
  const jsEditor = root.querySelector('#jsEditor');
  const assetsPreview = root.querySelector('#assetsPreview');
  const frame = root.querySelector('#previewFrame');
  const logEl = root.querySelector('#studioLog');

  const renderEditors = () => {
    root.querySelector('#appId').value = project.id || '';
    root.querySelector('#appName').value = project.name || '';
    root.querySelector('#appIcon').value = project.icon || '🧩';
    root.querySelector('#appWidth').value = project.window?.width || 900;
    root.querySelector('#appHeight').value = project.window?.height || 620;
    htmlEditor.value = project.html;
    cssEditor.value = project.css;
    jsEditor.value = project.js;
    assetsPreview.textContent = JSON.stringify(project.assets, null, 2);
  };

  const syncProject = () => {
    project.id = root.querySelector('#appId').value.trim() || 'my-first-app';
    project.name = root.querySelector('#appName').value.trim() || 'My LocalOS App';
    project.icon = root.querySelector('#appIcon').value.trim() || '🧩';
    project.window = {
      width: Math.max(380, Number(root.querySelector('#appWidth').value) || 900),
      height: Math.max(260, Number(root.querySelector('#appHeight').value) || 620),
    };
    project.html = htmlEditor.value;
    project.css = cssEditor.value;
    project.js = jsEditor.value;
  };

  const appendLog = (line) => {
    logEl.textContent += `${line}\n`;
    logEl.scrollTop = logEl.scrollHeight;
  };

  const buildPreviewDoc = () => `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>${project.css}</style>
  </head>
  <body>
    ${project.html}
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
          notify: (msg) => parent.postMessage({ type: 'localos-log', message: String(msg) }, '*'),
        };
      })();
    </script>
    <script type="module">
${project.js}
    </script>
  </body>
</html>`;

  const runPreview = () => {
    syncProject();
    frame.srcdoc = buildPreviewDoc();
    appendLog('Preview refreshed');
  };

  window.addEventListener('message', async (event) => {
    if (event.source !== frame.contentWindow) return;
    const data = event.data || {};
    if (data.type === 'localos-log') {
      appendLog(`[app] ${data.message}`);
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
        reply.result = project.assets[data.args[0]] ?? '';
      } else if (data.method === 'assets.list') {
        reply.result = Object.keys(project.assets);
      } else {
        throw new Error(`Unknown LocalOS API method: ${data.method}`);
      }
    } catch (error) {
      reply.error = error.message;
    }
    frame.contentWindow?.postMessage(reply, '*');
  });

  root.querySelector('#newProject').onclick = () => {
    project = defaults();
    renderEditors();
    runPreview();
    appendLog('New project created');
  };

  root.querySelector('#saveProject').onclick = async () => {
    syncProject();
    const path = root.querySelector('#projectPath').value;
    await ctx.fs.writeFile(path, JSON.stringify(project, null, 2), ctx.appId);
    appendLog(`Saved project to ${path}`);
  };

  root.querySelector('#loadProject').onclick = async () => {
    const path = root.querySelector('#projectPath').value;
    const raw = await ctx.fs.readFile(path, ctx.appId);
    const parsed = JSON.parse(raw);
    project = { ...defaults(), ...parsed, assets: parsed.assets || {} };
    renderEditors();
    runPreview();
    appendLog(`Loaded project ${path}`);
  };

  root.querySelector('#runPreview').onclick = runPreview;
  root.querySelector('#installApp').onclick = () => {
    syncProject();
    const appDef = {
      id: project.id,
      name: project.name,
      icon: project.icon,
      window: project.window,
      html: project.html,
      css: project.css,
      js: project.js,
      assets: project.assets,
      permissions: ['fs.read', 'fs.write'],
      source: 'appstudio',
    };
    const installed = JSON.parse(localStorage.getItem(window.LocalOS.STUDIO_APPS_KEY) || '[]').filter((app) => app.id !== appDef.id);
    installed.push(appDef);
    localStorage.setItem(window.LocalOS.STUDIO_APPS_KEY, JSON.stringify(installed));
    window.LocalOS.registerStudioApp(ctx.appRuntime, appDef);

    if (root.querySelector('#addDesktopShortcut').checked) {
      const shortcuts = new Set(JSON.parse(localStorage.getItem(window.LocalOS.DESKTOP_SHORTCUTS_KEY) || '[]'));
      shortcuts.add(appDef.id);
      localStorage.setItem(window.LocalOS.DESKTOP_SHORTCUTS_KEY, JSON.stringify([...shortcuts]));
    }
    appendLog(`Installed app ${appDef.name} (${appDef.id})`);
  };
  root.querySelector('#insertExample').onclick = () => {
    jsEditor.value += `\n// Example: list user documents\nconst docs = await LocalOS.fs.list('/home/guest/Documents');\nLocalOS.notify('Found ' + docs.length + ' entries in Documents');\n`;
    syncProject();
  };
  root.querySelector('#addAsset').onclick = () => {
    const name = root.querySelector('#assetName').value.trim();
    const url = root.querySelector('#assetUrl').value.trim();
    if (!name || !url) return;
    project.assets[name] = url;
    assetsPreview.textContent = JSON.stringify(project.assets, null, 2);
    appendLog(`Added asset ${name}`);
  };

  renderEditors();
  runPreview();
});
};
