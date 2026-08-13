/// <reference types="vite/client" />

// contentCompress.js 的模块声明（cloudStorage.ts 以相对路径引用 .js 模块）
declare module '*/contentCompress.js' {
  export function sanitizeContent(html: string): string;
  export function compressContent(text: string): string;
  export function decompressContent(text: string): string;
  export function compressDocContent(doc: Record<string, unknown> | null): Record<string, unknown> | null;
  export function decompressDocContent(doc: Record<string, unknown> | null): Record<string, unknown> | null;
  export function compressDocArray(docs: unknown[]): unknown[];
  export function decompressDocArray(docs: unknown[]): unknown[];
}
