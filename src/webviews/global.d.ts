import type { ConnectionProfile } from '../types/connection';

declare global {
  interface Window {
    vscodeApi: {
      postMessage(message: unknown): void;
      getState(): unknown;
      setState(state: unknown): void;
    };
    initialProfile?: Partial<ConnectionProfile> | null;
  }
}

declare module '*.css';

export {};
