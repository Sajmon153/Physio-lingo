/**
 * tests/e2e/harness/zipLoader.ts
 * Dual-Source Asset Loader: Reads from workspace disk if present, falls back to Fizjolingo.zip
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';

export interface ZipEntryMeta {
  name: string;
  method: number;
  compSize: number;
  uncompSize: number;
  locOffset: number;
}

export class ZipLoader {
  private static instance: ZipLoader;
  private zipBuffer: Buffer | null = null;
  private entries: Map<string, ZipEntryMeta> = new Map();
  private zipPath: string;

  private constructor() {
    this.zipPath = path.resolve(process.cwd(), 'Fizjolingo.zip');
    this.indexZip();
  }

  public static getInstance(): ZipLoader {
    if (!ZipLoader.instance) {
      ZipLoader.instance = new ZipLoader();
    }
    return ZipLoader.instance;
  }

  private indexZip(): void {
    if (!fs.existsSync(this.zipPath)) return;
    this.zipBuffer = fs.readFileSync(this.zipPath);
    const buf = this.zipBuffer;

    // Find EOCD (End of Central Directory)
    let eocd = -1;
    for (let i = buf.length - 22; i >= 0; i--) {
      if (buf.readUInt32LE(i) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd === -1) return;

    const cdCount = buf.readUInt16LE(eocd + 10);
    const cdOffset = buf.readUInt32LE(eocd + 16);

    let pos = cdOffset;
    for (let i = 0; i < cdCount; i++) {
      const method = buf.readUInt16LE(pos + 10);
      const compSize = buf.readUInt32LE(pos + 20);
      const uncompSize = buf.readUInt32LE(pos + 24);
      const fnLen = buf.readUInt16LE(pos + 28);
      const extraLen = buf.readUInt16LE(pos + 30);
      const commentLen = buf.readUInt16LE(pos + 32);
      const locOffset = buf.readUInt32LE(pos + 42);
      const name = buf.toString('utf8', pos + 46, pos + 46 + fnLen);
      pos += 46 + fnLen + extraLen + commentLen;
      // Normalize slashes
      const normName = name.replace(/\\/g, '/');
      this.entries.set(normName, { name: normName, method, compSize, uncompSize, locOffset });
    }
  }

  public hasFile(relPath: string): boolean {
    const norm = relPath.replace(/\\/g, '/');
    const diskPath = path.resolve(process.cwd(), norm);
    if (fs.existsSync(diskPath)) return true;
    return this.entries.has(norm);
  }

  public isExtractedOnDisk(relPath: string): boolean {
    const norm = relPath.replace(/\\/g, '/');
    const diskPath = path.resolve(process.cwd(), norm);
    return fs.existsSync(diskPath);
  }

  public readBinary(relPath: string): Buffer {
    const norm = relPath.replace(/\\/g, '/');
    const diskPath = path.resolve(process.cwd(), norm);
    if (fs.existsSync(diskPath)) {
      return fs.readFileSync(diskPath);
    }
    const meta = this.entries.get(norm);
    if (!meta || !this.zipBuffer) {
      throw new Error(`File not found on disk or in Fizjolingo.zip: ${relPath}`);
    }
    const buf = this.zipBuffer;
    const locFnLen = buf.readUInt16LE(meta.locOffset + 26);
    const locExtraLen = buf.readUInt16LE(meta.locOffset + 28);
    const start = meta.locOffset + 30 + locFnLen + locExtraLen;
    const raw = buf.subarray(start, start + meta.compSize);
    return meta.method === 0 ? Buffer.from(raw) : zlib.inflateRawSync(raw);
  }

  public readText(relPath: string): string {
    return this.readBinary(relPath).toString('utf8');
  }

  public listZipEntries(): string[] {
    return Array.from(this.entries.keys());
  }

  public getZipEntry(relPath: string): ZipEntryMeta | undefined {
    return this.entries.get(relPath.replace(/\\/g, '/'));
  }

  public getZipBufferSize(): number {
    return this.zipBuffer ? this.zipBuffer.length : 0;
  }
}
