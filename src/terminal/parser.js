export function tokenize(input) {
  return input.match(/"[^"]*"|'[^']*'|\S+/g)?.map((t) => t.replace(/^['"]|['"]$/g, '')) ?? [];
}

export function parseCommandLine(line) {
  const segments = [];
  let current = '';
  let op = null;
  for (let i = 0; i < line.length; i++) {
    const pair = line.slice(i, i + 2);
    if (pair === '&&' || pair === '||') {
      segments.push({ cmd: current.trim(), op });
      current = '';
      op = pair;
      i++;
      continue;
    }
    current += line[i];
  }
  if (current.trim()) segments.push({ cmd: current.trim(), op });

  return segments.map((s) => ({ ...s, pipeline: parsePipeline(s.cmd) }));
}

function parsePipeline(cmd) {
  return cmd.split('|').map((part) => {
    const tokens = tokenize(part.trim());
    const result = { cmd: tokens[0] ?? '', args: [], redirect: null };
    for (let i = 1; i < tokens.length; i++) {
      const tk = tokens[i];
      if (tk === '>' || tk === '>>') {
        result.redirect = { mode: tk, file: tokens[i + 1] };
        i++;
      } else {
        result.args.push(tk);
      }
    }
    return result;
  });
}
