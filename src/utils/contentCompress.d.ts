/**
 * contentCompress.js 的类型声明（供 cloudStorage.ts 等 TS 文件引用）
 */
export function sanitizeContent(html: string): string;
export function compressContent(text: string): string;
export function decompressContent(text: string): string;
export function compressDocContent(doc: Record<string, unknown> | null): Record<string, unknown> | null;
export function decompressDocContent(doc: Record<string, unknown> | null): Record<string, unknown> | null;
export function compressDocArray(docs: unknown[]): unknown[];
export function decompressDocArray(docs: unknown[]): unknown[];
