/// <reference types="vite/client" />

// Declare modules for raw shader imports
declare module '*.glsl' {
  const content: string;
  export default content;
}

declare module '*.vert' {
  const content: string;
  export default content;
}

declare module '*.frag' {
  const content: string;
  export default content;
}

declare module '*?raw' {
  const content: string;
  export default content;
}
