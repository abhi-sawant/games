# Free Games

Offline puzzle games: a PWA that also ships as an Android app through Capacitor. A home page links to each game.

- **Sudoku**: 20,000 bundled puzzles (5,000 each for Easy, Medium, Hard, Expert) from the public-domain
  [Sudoku Exchange Puzzle Bank](https://github.com/grantm/sudoku-exchange-puzzle-bank).
  Notes, undo, hints, mistake highlighting, a pausable timer, best times per level, and auto-saved progress.
- **Minesweeper**: Beginner, Intermediate and Expert boards with a safe first click, flags (long-press, right-click
  or flag mode), chording, a pausable timer, history and stats per level, and auto-saved progress.
- **2248**: drag a path through matching numbers (or each one step higher) to merge them; the sum rounds up to
  the next power of two. Ported from [Parth2500/2248-Merge](https://github.com/Parth2500/2248-Merge), with score,
  game over detection, history and stats per game, and auto-saved progress.
- After the first visit, the service worker caches every page and puzzle file, so it works with no connection.

## Layout

Each game is its own page with its own folder of code; the root page is the game picker.

```
index.html, src/main.ts, src/style.css   home page
src/base.css                             shared colours, buttons and dialogs (home page, Minesweeper, 2248)
sudoku/index.html, src/sudoku/           Sudoku
minesweeper/index.html, src/minesweeper/ Minesweeper
2248/index.html, src/2248/               2248
```

To add a game, create `<game>/index.html` and `src/<game>/`, add the page to `build.rolldownOptions.input` in
`vite.config.ts`, and add a card to `index.html`. Link to pages as `/<game>/index.html`, not `/<game>/`: the Android
app's local server answers extensionless paths with the root page. Keep saved data under a `<game>.` localStorage prefix.

## Web (PWA)

```bash
npm install
npm run dev       # development server
npm run build     # production build in dist/
npm run preview   # serve dist/ (the service worker only runs in a build)
```

Deploy `dist/` to any static host served over HTTPS.

## Android

Requires the Android SDK. Gradle 9.5 is pinned in `android/gradle/wrapper` so the build runs on Java 25
(the JDK bundled with current Android Studio).

```bash
npm run android:sync   # build the web app and copy it into android/
npm run android:open   # open in Android Studio to run or make a signed release
npm run android:apk    # or build a debug APK: android/app/build/outputs/apk/debug/app-debug.apk
```

Set `JAVA_HOME` if Gradle can't find a JDK, e.g.
`export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`.

## Releasing

The version lives only in `package.json`; the Android build derives `versionName` and `versionCode`
(`X*10000 + Y*100 + Z`) from it. Release builds are signed from `android/keystore.properties` (gitignored):

```properties
storeFile=keystore/games.jks
storePassword=...
keyAlias=games
keyPassword=...
```

In Claude Code, `/release X.Y.Z` bumps the version, updates `CHANGELOG.md`, builds, and assembles
`releases/vX.Y.Z/` with the signed APK, the PWA zip for `https://games.slowatcoding.com`, checksums and release notes.

## Puzzles

`public/puzzles/<level>.txt` holds one puzzle per line (81 digits, `0` = empty). To regenerate them,
download the four bank files and run:

```bash
node scripts/pack-puzzles.mjs path/to/bank
```

Expert uses the bank's "diabolical" puzzles with ratings up to 7.0. Harder ones need forcing chains.

## Icons

`public/icon.svg` is the source. Regenerate with `npx pwa-assets-generator --preset minimal-2023 public/icon.svg`
(web) and `npx capacitor-assets generate --android` (Android, from `assets/icon-only.png`).
