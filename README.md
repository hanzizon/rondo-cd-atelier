# 燐舞曲 · CD Atelier

Interactive 3D CD atelier with album covers, synchronized background music videos, and browser-local cover management.

Static site files live in `dist/`. GitHub Pages deploys this directory.

## Original Sites backup (version 19)

The complete, byte-identical original Sites source is preserved in `snapshots/sites-v19/`.
To publish the original Sites experience, run the Pages workflow manually with `source: sites-v19`.
The default `current` keeps the later GitHub additions. See [복원 안내](backup/RESTORE.md), [대조 결과](backup/AUDIT.md), and run `node backup/verify.cjs` to verify all 42 original files.

## Local preview

Run `python3 -m http.server 8000 --directory dist` and open http://localhost:8000.

## Personal covers

Uploaded covers and album ordering are stored in the current browser and origin. Data from the previous site does not automatically transfer to this new URL.

See `dist/CREDITS.md` for existing credits. Media and album artwork retain their respective owners’ rights.
