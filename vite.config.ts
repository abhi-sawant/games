import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  // The installed version, which the Android app compares against the latest GitHub release.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    rolldownOptions: {
      // One page per game, plus the home page that links to them.
      input: {
        home: 'index.html',
        sudoku: 'sudoku/index.html',
        minesweeper: 'minesweeper/index.html',
        '2248': '2248/index.html',
        '2048': '2048/index.html',
        tictactoe: 'tictactoe/index.html',
        dots: 'dots/index.html',
        killer: 'killer/index.html',
        kakuro: 'kakuro/index.html',
        nonograms: 'nonograms/index.html',
        takuzu: 'takuzu/index.html',
        nurikabe: 'nurikabe/index.html',
        hitori: 'hitori/index.html',
        starbattle: 'starbattle/index.html',
        lightsout: 'lightsout/index.html',
        threes: 'threes/index.html',
        fifteen: 'fifteen/index.html',
        connect4: 'connect4/index.html',
        reversi: 'reversi/index.html',
        gomoku: 'gomoku/index.html',
        morris: 'morris/index.html',
        checkers: 'checkers/index.html',
        klondike: 'klondike/index.html',
        freecell: 'freecell/index.html',
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Free Games',
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
      workbox: {
        // Precache the app shell and every puzzle file so the game works offline after the first load.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,txt,woff2}'],
      },
    }),
  ],
});
