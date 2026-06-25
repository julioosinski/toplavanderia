/// <reference types="vite/client" />

declare module '*.ino?raw' {
  const content: string;
  export default content;
}

declare module '*.h?raw' {
  const content: string;
  export default content;
}
