# LocalOS (Web-Based OS)

A backend-free web operating system prototype with multitasking features:

- GUI desktop with app launcher, start menu, and taskbar
- Draggable/minimizable window manager with active-window tracking
- LocalStorage-backed virtual file system
- Debian-style terminal emulator with expanded shell commands
- LOS (LocalOS Script) language + script editor
- Executables and scripts in the virtual filesystem
- Interactive Files app with directory navigation and inline editing
- Theme system (Dark, Midnight, Sunrise)
- Lightweight iframe browser and settings persistence

## Run

Open `index.html` directly, or serve with a static server:

```bash
python -m http.server 4173
```

Then visit `http://localhost:4173`.

## Terminal commands

- `help`
- `pwd`
- `date`
- `whoami`
- `ls [dir]`
- `tree [dir]`
- `cd <dir>`
- `cat <file>`
- `write <file> <text>`
- `mkdir <dir>`
- `touch <file>`
- `rm <path>`
- `mv <src> <dst>`
- `cp <src> <dst>`
- `run <script.los>`
- `exec <binary.exe> [args...]`
- `clear` / `cls`

## LOS language

- `PRINT "text"`
- `SET name "value"`
