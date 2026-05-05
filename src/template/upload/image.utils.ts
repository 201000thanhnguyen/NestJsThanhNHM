import path from 'path';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';

export function getUploadPath(...segments: string[]): string {
  return path.join(process.cwd(), 'uploads', 'images', ...segments);
}

export function generateFileName(): string {
  return `${randomUUID()}.webp`;
}

export async function ensureDirExists(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function deleteFileSafe(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (err: unknown) {
    if (isNodeErrnoException(err) && err.code === 'ENOENT') return;
    throw err;
  }
}

export function urlToDiskPath(url: string): string {
  // Expected url: /images/<filename>.webp. Only ever use basename for safety.
  const fileName = path.basename(url);
  return path.join(process.cwd(), 'uploads', 'images', fileName);
}

function isNodeErrnoException(err: unknown): err is { code?: string } {
  return typeof err === 'object' && err !== null && 'code' in err;
}
