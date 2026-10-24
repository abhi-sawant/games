---
name: release
description: Build a Free Sudoku release folder (PWA zip for sudoku.slowatcoding.com, signed APK, checksums, release notes) for a given version.
disable-model-invocation: true
argument-hint: <version, e.g. 1.0.1>
---

Create the release `$ARGUMENTS` for Free Sudoku. Work from the repo root. The PWA is hosted at the root of `https://sudoku.slowatcoding.com`; the APK is the Capacitor Android wrapper of the same build.

The version lives only in `package.json`. `android/app/build.gradle` reads it: `versionName` is `X.Y.Z` and `versionCode` is `X*10000 + Y*100 + Z`.

## 0. Validate

- `$ARGUMENTS` must be SemVer `X.Y.Z` (strip a leading `v`), with `Y` and `Z` below 100 (the versionCode scheme). If missing or malformed, ask for it and stop.
- It must be greater than the current `version` in `package.json`, unless it already equals it (the first release, or a bump done by hand). If `releases/vX.Y.Z/` already exists, ask before overwriting.
- Confirm `android/keystore.properties` exists (keys `storeFile`, `storePassword`, `keyAlias`, `keyPassword`; `storeFile` is relative to `android/`), otherwise the APK would be unsigned: stop and tell the user. If they have no keystore yet, give them this to run themselves, and remind them to back up the keystore and passwords outside the repo (losing it means the app can never be updated):

  ```bash
  keytool -genkeypair -v -keystore android/keystore/free-sudoku.jks -alias free-sudoku -keyalg RSA -keysize 4096 -validity 10000
  ```

## 1. Work out what changed

Take the latest changes in the working tree and since the last tag/release: `git status`, `git diff`, and `git log` since the last `v*` tag (or, with no tag, the whole history for a first release). Read the diffs of user-visible changes (features, fixes, behaviour, puzzles, offline support); ignore pure refactors and docs unless they matter to players. If the tree has changes, they are part of this release; do not commit them.

## 2. Bump and document

- Set the version with `npm version X.Y.Z --no-git-tag-version` (updates `package.json` and `package-lock.json`, no commit or tag). Skip if it already equals `X.Y.Z`.
- Add a `## X.Y.Z — <today's date, YYYY-MM-DD>` section at the top of `CHANGELOG.md`, above the previous release, using `### Added / Changed / Fixed` as needed. Write for players, in the existing voice. If `CHANGELOG.md` doesn't exist, create it with a `# Changelog` heading first.

## 3. Verify and build

Run, stopping on any failure and reporting it:

```bash
npm run build && npx cap sync android
cd android && export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" && ./gradlew clean :app:assembleRelease
```

Then check the web build is fit for hosting at the domain root:

- `dist/` contains `index.html`, `sudoku/index.html`, `minesweeper/index.html`, `manifest.webmanifest`, `sw.js`, `workbox-*.js` and `puzzles/*.txt`, and `sw.js` precaches all three pages.
- `manifest.webmanifest` has `"start_url":"/"`, and asset URLs in `dist/index.html` are root-relative (`/assets/...`), not prefixed with a sub-path.

Check the APK: `~/Library/Android/sdk/build-tools/<latest>/aapt2 dump badging <apk> | head -1` must show `versionName='X.Y.Z'` and the expected `versionCode`.

## 4. Assemble `releases/vX.Y.Z/` (gitignored)

- `free-sudoku-X.Y.Z.apk`: copy `android/app/build/outputs/apk/release/app-release.apk`.
- `free-sudoku-web-X.Y.Z.zip`: zip the *contents* of `dist/` (files at the zip root, no `.DS_Store`): `cd dist && zip -qr ../releases/vX.Y.Z/free-sudoku-web-X.Y.Z.zip . -x '*.DS_Store'`.
- `SHA256SUMS.txt`: `shasum -a 256` of the two files, run inside the folder, two-space separator, bare filenames.
- `RELEASE_NOTES.md`: model it on the previous `releases/v*/RELEASE_NOTES.md` if there is one. Title `# Free Sudoku X.Y.Z — <headline>`, plain-language sections for what's new, a Downloads table (file, size, what it's for), a "Hosting" note (unzip into the web root of `sudoku.slowatcoding.com` over HTTPS, replacing the old files; serve `sw.js`, `index.html` and `manifest.webmanifest` with `Cache-Control: no-cache` so installed copies pick up the update; `assets/` is content-hashed and can be cached long), and the APK signing certificate line. Read the cert with `~/Library/Android/sdk/build-tools/<latest>/apksigner verify --print-certs <apk>` (needs `JAVA_HOME` as above) and format the SHA-256 digest as colon-separated lowercase hex. It must equal the previous release's cert; if not, warn loudly because Android will refuse the update. For the first release, say so and note the cert is now the reference.

## 5. Report

Summarise: version and versionCode, folder contents with sizes, the cert check, and the changelog entry. Do NOT commit, tag, push, upload to the server, or create a GitHub release; remind the user of the remaining steps (commit the version bump and changelog, merge to `main`, tag `vX.Y.Z`, upload the zip's contents to `sudoku.slowatcoding.com`, attach the APK and zip to a GitHub Release using the CHANGELOG section as notes).
