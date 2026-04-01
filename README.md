# LocalOS (Web-Based OS)

A backend-free web operating system prototype with multitasking features:

- GUI desktop with app launcher, start menu, and taskbar
- Draggable/minimizable window manager with active-window tracking
- LocalStorage-backed virtual file system
- Debian-style terminal emulator with expanded shell commands
- LOS (LocalOS Script) language + script editor
- Web app platform: build apps with HTML/CSS/JS and run them in a sandbox
- LocalOS.fs API bridge for app-controlled filesystem access
- Executables and scripts in the virtual filesystem
- Interactive Files app with directory navigation and inline editing
- Terminal command history + quick file search command
- Files app supports deleting the currently opened file
- Theme system (Dark, Midnight, Sunrise)
- Customizer app for window style and global custom CSS
- Lightweight iframe browser and settings persistence
- Tutorial app that teaches LocalOS filesystem API usage

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
- `find <query> [dir]`
- `history`
- `cd <dir>`
- `cat <file>`
- `write <file> <text>`
- `mkdir <dir>`
- `touch <file>`
- `rm <path>`
- `mv <src> <dst>`
- `cp <src> <dst>`
- `run <script.los>`
- `openapp <path/to/app.webapp>`
- `exec <binary.exe> [args...]`
- `clear` / `cls`

## LOS language

- `PRINT "text"`
- `SET name "value"`
- `READ "/path/file.txt"`
- `WRITE "/path/file.txt" "text"`
- `LIST "/dir"`
- `MKDIR "/dir"`
- `DELETE "/path"`

## LocalOS.fs API for Web Apps

Inside a LocalOS web app, use:

- `await LocalOS.fs.readFile(path)`
- `await LocalOS.fs.writeFile(path, content)`
- `await LocalOS.fs.listDir(path)`
- `await LocalOS.fs.mkdir(path)`
- `await LocalOS.fs.remove(path)`
- `await LocalOS.fs.exists(path)`

Use **App Studio** to create `.webapp` bundles and **Web App Runner** to execute them.

## Productivity shortcuts

- `Ctrl + Space` toggles the Start menu
- `Esc` closes Start menu, or closes the top-most window when Start is hidden
