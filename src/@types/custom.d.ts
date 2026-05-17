declare interface Window {
  initialThemeKind?: number;
}
declare global {
  interface Window {
    acquireVsCodeApi?: () => {
      postMessage: (msg: any) => void;
      getState?: () => any;
      setState?: (state: any) => void;
    };

    vscode?: {
      postMessage: (msg: any) => void;
      getState?: () => any;
      setState?: (state: any) => void;
    };

    vscodeState?: any;
  }
}

export {};
// custom.d.ts
// Global type declarations for VS Code webview environment

// -------- VS Code Webview API --------
interface VsCodeApi {
  postMessage: (msg: any) => void;
  getState?: () => any;
  setState?: (state: any) => void;
}

declare function acquireVsCodeApi(): VsCodeApi;

// -------- Window Extensions --------
declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeApi;
  }
}

// -------- Message Types --------
export interface ExtensionMessage<T = any> {
  type: string;
  payload?: T;
}

// Allow importing .svg/.png/etc inside React UI
declare module "*.svg" {
  const src: string;
  export default src;
}

declare module "*.png" {
  const src: string;
  export default src;
}

declare module "*.jpg" {
  const src: string;
  export default src;
}

// Allow importing CSS modules
declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}

declare module "*.module.scss" {
  const classes: { [key: string]: string };
  export default classes;
}

export {};
