# LocalOS (Web-Based OS)

A backend-free web operating system prototype:

- GUI desktop with app launcher and window manager
- LocalStorage-backed virtual file system
- Debian-style terminal emulator with basic shell commands
- LOS (LocalOS Script) language + script editor
- Executables and scripts in the virtual filesystem
- Basic apps: Settings, Files, lightweight Browser

## Run

Open `index.html` directly, or serve with a static server:

```bash
python -m http.server 4173
```

Then visit `http://localhost:4173`.

## Terminal commands

- `help`
- `ls [dir]`
- `cat <file>`
- `write <file> <text>`
- `mkdir <dir>`
- `touch <file>`
- `run <script.los>`
- `exec <binary.exe> [args...]`
- `clear`

## LOS language

- `PRINT "text"`
- `SET name "value"`
