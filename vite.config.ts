import { existsSync, readdirSync } from 'node:fs';
import { basename } from 'node:path';
import { type Plugin, defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

// One page per game, in home page order, which is also the order the service worker caches them in.
const games = [
  'sudoku', 'killer', 'kakuro', 'calcudoku', 'futoshiki', 'skyscrapers', 'jigsaw', 'sudokux', 'minesweeper',
  'nonograms', 'takuzu', 'nurikabe', 'hitori', 'starbattle', 'lightsout', 'tents', 'lightup', 'heyawake', 'lits',
  'slitherlink', 'masyu', 'bridges', 'flow', '2248', '2048', 'threes', 'fifteen', 'tictactoe', 'dots', 'connect4',
  'reversi', 'gomoku', 'morris', 'checkers', 'klondike', 'freecell', 'spider', 'yukon', 'canfield', 'fortythieves',
  'pyramid', 'tripeaks', 'golf',
];

// The built files each game needs that the home page doesn't, in home page order, so the service worker can
// install with just the home page and cache each game on demand (see src/sw.ts). Filled in once the app is
// written, then handed to the service worker build, which runs after it, as `virtual:game-files`.
const gameFiles: [game: string, files: string[]][] = [];

function collectGameFiles(): Plugin {
  return {
    name: 'collect-game-files',
    apply: 'build',
    writeBundle(_, bundle) {
      // Built files refer to each other by file name: HTML to its scripts and styles, scripts to the chunks
      // and workers they load, styles to fonts. Follow those references from each page.
      const files = Object.keys(bundle);
      const refs = new Map(files.map((file) => {
        const item = bundle[file];
        const text = item.type === 'chunk' ? item.code : typeof item.source === 'string' ? item.source : '';
        return [file, files.filter((f) => f !== file && !f.endsWith('.html') && text.includes(basename(f)))];
      }));
      const reach = (page: string) => {
        const seen = new Set([page]);
        for (const file of seen) for (const ref of refs.get(file) ?? []) seen.add(ref);
        return seen;
      };
      // Puzzles come from public/ and are fetched by path: puzzles/<game>/*.txt, and Sudoku's in puzzles/.
      const puzzles = (dir: string) =>
        readdirSync(`public/${dir}`).filter((f) => f.endsWith('.txt')).map((f) => `${dir}/${f}`);

      const home = reach('index.html');
      gameFiles.length = 0;
      for (const game of games) {
        const own = [...reach(`${game}/index.html`)].filter((f) => !home.has(f));
        const dir = game === 'sudoku' ? 'puzzles' : `puzzles/${game}`;
        gameFiles.push([game, [...own, ...(existsSync(`public/${dir}`) ? puzzles(dir) : [])]]);
      }
    },
  };
}

function gameFilesModule(): Plugin {
  const id = 'virtual:game-files';
  return {
    name: 'game-files-module',
    resolveId: (source) => (source === id ? `\0${id}` : undefined),
    load: (source) => (source === `\0${id}` ? `export default ${JSON.stringify(gameFiles)};` : undefined),
  };
}

export default defineConfig({
  // The installed version, which the Android app compares against the latest GitHub release.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    rolldownOptions: {
      // One page per game, plus the home page that links to them.
      input: { home: 'index.html', ...Object.fromEntries(games.map((g) => [g, `${g}/index.html`])) },
    },
  },
  plugins: [
    collectGameFiles(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['favicon.ico', 'icon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Games',
        short_name: 'Games',
        description: 'Free offline puzzle, board and card games.',
        theme_color: '#eef0f3',
        background_color: '#eef0f3',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        // Every file goes in the manifest, so the service worker knows each one's revision, but it downloads
        // only the home page's up front.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,txt,woff2}'],
        buildPlugins: { vite: [gameFilesModule()] },
      },
    }),
  ],
});
