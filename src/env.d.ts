/** The package.json version, injected by Vite at build time. */
declare const __APP_VERSION__: string;

/** Each game's built files that the home page doesn't need, in home page order, from vite.config.ts. */
declare module 'virtual:game-files' {
  const gameFiles: [game: string, files: string[]][];
  export default gameFiles;
}
