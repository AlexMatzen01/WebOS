# LocalOS (Production-Style Browser OS)

LocalOS is a frontend-only operating system simulation that runs fully in the browser (HTML/CSS/JavaScript) with no backend.

## What's new in this architecture

- Modular core (`event bus`, `process manager`, `plugin system`)
- IndexedDB-backed virtual filesystem with metadata + cache
- Mount points (`/home`, `/system`, `/mnt`, `/dev`)
- Virtual devices (`/dev/null`, `/dev/random`)
- Symlink support and per-app permission checks
- Terminal parser with piping (`|`), redirection (`>`, `>>`), and chaining (`&&`, `||`)
- Environment variables (`$HOME`, `$PATH`, `$USER`) and PATH binary lookup
- Package command: `lospkg install <pkg>`
- LOS language runtime with `IF/ELSE`, `FOR`, `WHILE`, `FUNC/CALL`, `CMD` integration, and parse errors
- Window manager upgrades: snapping, z-order focus, resize constraints, virtual desktops, animate-ready states
- App runtime with explicit app manifests, permission prompts, background services
- Built-in advanced apps: File Explorer, Terminal (tab-ready shell), Browser, Text Editor (LOS execution), Task Manager
- System features: notifications, clipboard capture history, persistent settings, multi-user login/lock screen simulation

## Refactored structure

```text
src/
  main.js
  core/
    eventBus.js
    processManager.js
    pluginSystem.js
  fs/
    vfs.js
  terminal/
    parser.js
    shell.js
  los/
    interpreter.js
  wm/
    windowManager.js
  runtime/
    appRuntime.js
  apps/
    builtinApps.js
index.html
style.css
```

## Run

```bash
python -m http.server 4173
```

Then open: <http://localhost:4173>

## Terminal quick examples

```bash
ls /home/guest
cat /dev/random
echo hello | cat
echo test > /home/guest/out.txt
echo world >> /home/guest/out.txt
export PATH=/system/bin:/home/guest/bin && echo ok
lospkg install syntax-tools
```

## LOS language sample

```los
SET n "0"
WHILE $n < 3
  PRINT "Loop $n"
  SET n "$n + 1"
ENDWHILE

FUNC greet
  PRINT "Hello from function"
ENDFUNC

CALL greet
CMD "ls /home/guest"
```

