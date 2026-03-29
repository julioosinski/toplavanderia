/// <reference types="vite/client" />

declare module '*.ino?raw' {
  const content: string;
  export default content;
}
