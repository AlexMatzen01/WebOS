import { parseCommandLine } from './parser.js';

export class Shell {
  constructor({ vfs, bus, processManager, appRuntime }) {
    this.vfs = vfs;
    this.bus = bus;
    this.pm = processManager;
    this.appRuntime = appRuntime;
    this.cwd = '/home/guest';
    this.env = { HOME: '/home/guest', PATH: '/system/bin:/home/guest/bin', USER: 'guest' };
    this.commands = new Map();
    this.history = [];
    this.registerBuiltins();
  }

  register(name, fn) {
    this.commands.set(name, fn);
  }

  expandEnv(text) {
    return text.replace(/\$([A-Z_][A-Z0-9_]*)/gi, (_, key) => this.env[key] ?? '');
  }

  async run(line) {
    if (line.trim()) {
      this.history.push(line.trim());
      if (this.history.length > 250) this.history.shift();
    }
    const proc = this.pm.spawn({ name: `shell:${line.slice(0, 24)}`, type: 'shell' });
    let exitCode = 0;
    let output = '';
    const segments = parseCommandLine(this.expandEnv(line));

    for (const segment of segments) {
      if (segment.op === '&&' && exitCode !== 0) continue;
      if (segment.op === '||' && exitCode === 0) continue;
      const result = await this.runPipeline(segment.pipeline);
      exitCode = result.code;
      output += result.output;
    }

    this.pm.kill(proc.pid);
    return { code: exitCode, output };
  }

  async runPipeline(pipeline) {
    let stdin = '';
    let code = 0;
    for (const step of pipeline) {
      const cmd = step.cmd;
      const args = step.args;
      const result = await this.execute(cmd, args, stdin);
      stdin = result.output;
      code = result.code;
      if (step.redirect?.file) {
        const target = this.resolve(step.redirect.file);
        const previous = step.redirect.mode === '>>' ? await this.safeRead(target) : '';
        await this.vfs.writeFile(target, previous + stdin);
      }
    }
    return { code, output: stdin };
  }

  async execute(name, args, stdin = '') {
    if (this.commands.has(name)) return this.commands.get(name)({ args, stdin, shell: this });
    const binPath = await this.lookupExecutable(name);
    if (binPath) {
      if (name === 'echo') return { code: 0, output: `${args.join(' ')}\n` };
    }
    return { code: 127, output: `Command not found: ${name}\n` };
  }

  async lookupExecutable(name) {
    for (const dir of this.env.PATH.split(':')) {
      const path = `${dir}/${name}.exe`.replace('//', '/');
      try {
        await this.vfs.readFile(path);
        return path;
      } catch {}
    }
    return null;
  }

  resolve(path) {
    if (path.startsWith('/')) return path;
    return `${this.cwd}/${path}`.replace('//', '/');
  }

  prompt() {
    return `${this.env.USER || 'guest'}@localos:${this.cwd}$`;
  }

  async safeRead(path) {
    try { return await this.vfs.readFile(path); } catch { return ''; }
  }

  registerBuiltins() {
    this.register('help', async () => ({
      code: 0,
      output: `Builtins:
help pwd ls cd cat echo touch mkdir rm mv cp tree head tail grep wc
history clear whoami date uname env export which ps kill open lospkg
`,
    }));
    this.register('echo', async ({ args, stdin }) => ({ code: 0, output: `${args.length ? args.join(' ') : stdin}` + (args.length ? '\n' : '') }));
    this.register('pwd', async () => ({ code: 0, output: `${this.cwd}\n` }));
    this.register('ls', async ({ args }) => {
      const path = this.resolve(args[0] || this.cwd);
      const list = await this.vfs.list(path);
      return {
        code: 0,
        output: `${list.map((n) => `${n.type === 'dir' ? 'd' : n.type === 'symlink' ? 'l' : '-'} ${n.path.split('/').pop()}`).join('\n')}\n`,
      };
    });
    this.register('cd', async ({ args }) => {
      const path = this.resolve(args[0] || this.env.HOME);
      const node = await this.vfs.get(path);
      if (!node || node.type !== 'dir') return { code: 1, output: 'cd: not a directory\n' };
      this.cwd = path;
      return { code: 0, output: '' };
    });
    this.register('cat', async ({ args, stdin }) => {
      if (!args[0]) return { code: 0, output: stdin };
      const content = await this.vfs.readFile(this.resolve(args[0]));
      return { code: 0, output: `${content}\n` };
    });
    this.register('touch', async ({ args }) => {
      if (!args[0]) return { code: 1, output: 'touch <file>\n' };
      const path = this.resolve(args[0]);
      const current = await this.safeRead(path);
      await this.vfs.writeFile(path, current);
      return { code: 0, output: '' };
    });
    this.register('mkdir', async ({ args }) => {
      if (!args[0]) return { code: 1, output: 'mkdir <dir>\n' };
      await this.vfs.mkdir(this.resolve(args[0]));
      return { code: 0, output: '' };
    });
    this.register('rm', async ({ args }) => {
      if (!args[0]) return { code: 1, output: 'rm <path>\n' };
      const path = this.resolve(args[0]);
      await this.vfs.remove(path);
      return { code: 0, output: '' };
    });
    this.register('mv', async ({ args }) => {
      if (args.length < 2) return { code: 1, output: 'mv <src> <dest>\n' };
      await this.vfs.move(this.resolve(args[0]), this.resolve(args[1]));
      return { code: 0, output: '' };
    });
    this.register('cp', async ({ args }) => {
      if (args.length < 2) return { code: 1, output: 'cp <src> <dest>\n' };
      await this.vfs.copy(this.resolve(args[0]), this.resolve(args[1]));
      return { code: 0, output: '' };
    });
    this.register('tree', async ({ args }) => {
      const root = this.resolve(args[0] || this.cwd);
      const rows = [];
      const walk = async (path, depth = 0) => {
        const node = await this.vfs.get(path, { followLinks: false });
        if (!node) return;
        const name = path === '/' ? '/' : path.split('/').pop();
        rows.push(`${'  '.repeat(depth)}${name}${node.type === 'dir' ? '/' : ''}`);
        if (node.type === 'dir') {
          for (const child of node.children || []) await walk(child, depth + 1);
        }
      };
      await walk(root);
      return { code: 0, output: `${rows.join('\n')}\n` };
    });
    this.register('head', async ({ args, stdin }) => {
      const count = Number(args[0]) || 10;
      const source = args[1] ? await this.vfs.readFile(this.resolve(args[1])) : stdin;
      return { code: 0, output: `${source.split('\n').slice(0, count).join('\n')}\n` };
    });
    this.register('tail', async ({ args, stdin }) => {
      const count = Number(args[0]) || 10;
      const source = args[1] ? await this.vfs.readFile(this.resolve(args[1])) : stdin;
      return { code: 0, output: `${source.split('\n').slice(-count).join('\n')}\n` };
    });
    this.register('grep', async ({ args, stdin }) => {
      if (!args[0]) return { code: 1, output: 'grep <pattern> [file]\n' };
      const pattern = args[0];
      const source = args[1] ? await this.vfs.readFile(this.resolve(args[1])) : stdin;
      const lines = source.split('\n').filter((line) => line.includes(pattern));
      return { code: lines.length ? 0 : 1, output: `${lines.join('\n')}${lines.length ? '\n' : ''}` };
    });
    this.register('wc', async ({ args, stdin }) => {
      const source = args[0] ? await this.vfs.readFile(this.resolve(args[0])) : stdin;
      const lines = source ? source.split('\n').length : 0;
      const words = source.trim() ? source.trim().split(/\s+/).length : 0;
      const chars = source.length;
      return { code: 0, output: `${lines} ${words} ${chars}\n` };
    });
    this.register('history', async () => ({ code: 0, output: `${this.history.map((line, i) => `${i + 1}  ${line}`).join('\n')}\n` }));
    this.register('clear', async () => ({ code: 0, output: '\u001b[2J\u001b[H' }));
    this.register('whoami', async () => ({ code: 0, output: `${this.env.USER}\n` }));
    this.register('date', async () => ({ code: 0, output: `${new Date().toISOString()}\n` }));
    this.register('uname', async () => ({ code: 0, output: 'LocalOS 2.0 browser-kernel\n' }));
    this.register('env', async () => ({ code: 0, output: `${Object.entries(this.env).map(([k, v]) => `${k}=${v}`).join('\n')}\n` }));
    this.register('export', async ({ args }) => {
      const [k, v] = (args[0] || '').split('=');
      if (k) this.env[k] = v ?? '';
      return { code: 0, output: '' };
    });
    this.register('which', async ({ args }) => {
      if (!args[0]) return { code: 1, output: 'which <command>\n' };
      if (this.commands.has(args[0])) return { code: 0, output: `${args[0]}: shell builtin\n` };
      const binPath = await this.lookupExecutable(args[0]);
      return { code: binPath ? 0 : 1, output: `${binPath || ''}${binPath ? '\n' : ''}` };
    });
    this.register('ps', async () => {
      const lines = this.pm.list().map((p) => `${p.pid}\t${p.state}\t${p.cpu}%\t${p.memory}MB\t${p.name}`);
      return { code: 0, output: `PID\tSTATE\tCPU\tMEM\tNAME\n${lines.join('\n')}\n` };
    });
    this.register('kill', async ({ args }) => {
      const pid = Number(args[0]);
      if (!pid) return { code: 1, output: 'kill <pid>\n' };
      this.pm.kill(pid);
      return { code: 0, output: '' };
    });
    this.register('lospkg', async ({ args }) => {
      if (args[0] !== 'install' || !args[1]) return { code: 1, output: 'Usage: lospkg install <pkg>\n' };
      const pkg = args[1];
      await this.vfs.mkdir('/home/guest/packages');
      await this.vfs.writeFile(`/home/guest/packages/${pkg}.json`, JSON.stringify({ name: pkg, installedAt: Date.now() }, null, 2));
      return { code: 0, output: `Installed ${pkg}\n` };
    });
    this.register('open', async ({ args }) => {
      if (!args[0]) return { code: 1, output: 'open <appId>\n' };
      this.appRuntime.launch(args[0]);
      return { code: 0, output: '' };
    });
  }
}
