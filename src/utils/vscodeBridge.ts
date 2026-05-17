// src/utils/vscodeBridge.ts

export type MessageHandler = (payload: any) => void;

/* -------------------------------------------------------------------------- */
/*                               Handler Store                                */
/* -------------------------------------------------------------------------- */

const handlers: Record<string, MessageHandler[]> = {};

/* -------------------------------------------------------------------------- */
/*                           VS Code API Accessor                              */
/* -------------------------------------------------------------------------- */

/**
 * Get the already-acquired VS Code API instance.
 * It MUST be created once in HTML and attached to window.vscode
 */
function getVSCodeApi():
  | {
      postMessage: (msg: any) => void;
      getState?: () => any;
      setState?: (state: any) => void;
    }
  | undefined {
  const vscode = (window as any).vscode;

  if (!vscode) {
    console.warn(" VS Code API not found on window. Did HTML bootstrap run?");
    return;
  }

  return vscode;
}

/* -------------------------------------------------------------------------- */
/*                          Outgoing → Extension                               */
/* -------------------------------------------------------------------------- */

/**
 * Sends a message from the webview to the VS Code extension backend.
 * ALWAYS sends messages in the shape: { type, payload }
 */
export function postToExtension(type: string, payload: any = {}) {
  const vscode = getVSCodeApi();
  if (!vscode) {return;}

  vscode.postMessage({
    type,
    payload,
  });
}

/* -------------------------------------------------------------------------- */
/*                          Incoming ← Extension                               */
/* -------------------------------------------------------------------------- */

/**
 * Registers a listener for messages coming from the VS Code extension.
 * Returns a cleanup function to unregister the handler.
 */
export function onExtensionMessage(
  type: string,
  handler: MessageHandler
): () => void {
  if (!handlers[type]) {
    handlers[type] = [];
  }

  handlers[type].push(handler);

  return () => {
    handlers[type] = handlers[type].filter((h) => h !== handler);
  };
}

/* -------------------------------------------------------------------------- */
/*                      Global Message Dispatcher (SAFE)                       */
/* -------------------------------------------------------------------------- */

/**
 * Ensure we only attach ONE global message listener,
 * even if this module is bundled / hot-reloaded multiple times.
 */
declare global {
  interface Window {
    __devpilotBridgeInitialized?: boolean;
  }
}

if (!(window as any).__devpilotBridgeInitialized) {
  (window as any).__devpilotBridgeInitialized = true;

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (!message?.type) {return;}

    const { type, payload } = message;

    const list = handlers[type];
    if (!list || list.length === 0) {return;}

    // Fault isolation: one bad handler must NOT break others
    for (const fn of list) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[DevPilot] handler error for "${type}"`, err);
      }
    }
  });
}
