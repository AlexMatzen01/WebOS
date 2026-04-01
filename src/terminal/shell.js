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
    this.registerBuiltins();
  }

  register(name, fn) {
    this.commands.set(name, fn);
  }

  expandEnv(text) {
    return text.replace(/\$([A-Z_][A-Z0-9_]*)/gi, (_, key) => this.env[key] ?? '');
  }

  async run(line) {
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

  async safeRead(path) {
    try { return await this.vfs.readFile(path); } catch { return ''; }
  }

  registerBuiltins() {
    this.register('pwd', async () => ({ code: 0, output: `${this.cwd}\n` }));
    this.register('ls', async ({ args }) => {
      const path = this.resolve(args[0] || this.cwd);
      const list = await this.vfs.list(path);
      return { code: 0, output: `${list.map((n) => n.path.split('/').pop()).join('\n')}\n` };
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
    this.register('export', async ({ args }) => {
      const [k, v] = (args[0] || '').split('=');
      if (k) this.env[k] = v ?? '';
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
