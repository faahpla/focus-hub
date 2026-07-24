// electron-vite ?asset imports resolve to a file path valid in dev and prod.
declare module '*?asset' {
  const src: string
  export default src
}
