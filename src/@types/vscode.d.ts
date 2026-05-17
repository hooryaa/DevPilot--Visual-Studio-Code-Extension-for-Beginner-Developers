declare global {
  interface Window {
    vscode?: {
      postMessage: (msg: any) => void;
      getState?: () => any;
      setState?: (state: any) => void;
    };
  }
}

export {};




