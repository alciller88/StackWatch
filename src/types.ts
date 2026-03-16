export * from '../shared/types';

declare global {
  interface Window {
    stackwatch: import('../shared/types').StackWatchAPI;
  }
}
