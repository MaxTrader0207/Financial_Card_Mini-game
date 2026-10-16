/// <reference types="vite/client" />
declare const __BUILD__: { time: string; commit: string };
declare const __API__: string;
declare module '@data-source' {
  export function loadData(): Promise<import('./core/types').DataSet>;
}
