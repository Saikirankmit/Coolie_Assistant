declare module 'busboy' {
  interface FileInfo { filename?: string; mimeType?: string }
  interface Busboy {
    on(event: string, cb: (...args: any[]) => void): this;
  }
  const BusboyFactory: any;
  export default BusboyFactory;
}
