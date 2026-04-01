export class LOSInterpreter {
  constructor(shell) {
    this.shell = shell;
    this.vars = {};
    this.functions = new Map();
  }

  async run(source) {
    const lines = source.split('\n').map((l) => l.trim()).filter(Boolean);
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('PRINT ')) out.push(this.interpolate(line.slice(6).replace(/^"|"$/g, '')));
      else if (line.startsWith('SET ')) {
        const [, k, ...v] = line.split(' ');
        this.vars[k] = this.interpolate(v.join(' ').replace(/^"|"$/g, ''));
      } else if (line.startsWith('CMD ')) {
        const result = await this.shell.run(this.interpolate(line.slice(4)));
        out.push(result.output.trimEnd());
      } else if (line.startsWith('IF ')) {
        const condition = this.evalExpr(line.slice(3));
        const block = this.collectBlock(lines, i + 1, ['ELSE', 'ENDIF']);
        if (condition) out.push(...await this.run(block.body.join('\n')).then((r) => r.output));
        else if (block.stopToken === 'ELSE') {
          const elseBlock = this.collectBlock(lines, block.nextIndex + 1, ['ENDIF']);
          out.push(...await this.run(elseBlock.body.join('\n')).then((r) => r.output));
          i = elseBlock.nextIndex;
          continue;
        }
        i = block.nextIndex;
      } else if (line.startsWith('WHILE ')) {
        const block = this.collectBlock(lines, i + 1, ['ENDWHILE']);
        let guard = 0;
        while (this.evalExpr(line.slice(6)) && guard++ < 500) {
          out.push(...await this.run(block.body.join('\n')).then((r) => r.output));
        }
        i = block.nextIndex;
      } else if (line.startsWith('FOR ')) {
        const [, varName, , startStr, , endStr] = line.split(' ');
        const block = this.collectBlock(lines, i + 1, ['ENDFOR']);
        for (let n = Number(startStr); n <= Number(endStr); n++) {
          this.vars[varName] = String(n);
          out.push(...await this.run(block.body.join('\n')).then((r) => r.output));
        }
        i = block.nextIndex;
      } else if (line.startsWith('FUNC ')) {
        const name = line.split(' ')[1];
        const block = this.collectBlock(lines, i + 1, ['ENDFUNC']);
        this.functions.set(name, block.body.join('\n'));
        i = block.nextIndex;
      } else if (line.startsWith('CALL ')) {
        const name = line.split(' ')[1];
        if (!this.functions.has(name)) throw new Error(`Unknown function ${name}`);
        out.push(...await this.run(this.functions.get(name)).then((r) => r.output));
      } else {
        throw new Error(`LOS parse error at line: ${line}`);
      }
    }
    return { output: out };
  }

  collectBlock(lines, start, tokens) {
    const body = [];
    for (let i = start; i < lines.length; i++) {
      if (tokens.includes(lines[i])) return { body, stopToken: lines[i], nextIndex: i };
      body.push(lines[i]);
    }
    throw new Error(`Missing block terminator: ${tokens.join(' or ')}`);
  }

  evalExpr(expr) {
    expr = this.interpolate(expr).trim();
    try { return Boolean(Function(`return (${expr})`)()); } catch { return false; }
  }

  interpolate(text) {
    return text.replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, k) => this.vars[k] ?? '');
  }
}
