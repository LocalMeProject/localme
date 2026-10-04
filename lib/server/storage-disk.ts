/**
 * Disk-based project file storage.
 *
 * Stores project files on disk at `<STORAGE_ROOT>/<projectId>/<path>`
 * instead of storing large byte arrays as SQLite database blobs.
 * Path traversal is strictly prevented.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

export function getStorageRoot(): string {
  return process.env.STORAGE_DATA_DIR
    ? path.resolve(process.env.STORAGE_DATA_DIR)
    : path.join(process.cwd(), "storage_data");
}

export function getSafeDiskPath(projectId: number, relativePath: string): string {
  const root = getStorageRoot();
  const projectRoot = path.join(root, String(projectId));
  // Clean path: strip leading slashes and any .. traversal segments
  const cleanPath = relativePath
    .replace(/^[/\\]+/, "")
    .split(/[/\\]+/)
    .filter((segment) => segment && segment !== ".." && segment !== ".")
    .join(path.sep);

  const resolved = path.resolve(projectRoot, cleanPath);
  if (!resolved.startsWith(projectRoot + path.sep) && resolved !== projectRoot) {
    throw new Error("Invalid file path traversal.");
  }
  return resolved;
}

export async function writeDiskFile(
  projectId: number,
  relativePath: string,
  content: Buffer,
): Promise<{ diskPath: string; sizeBytes: number }> {
  const fullPath = getSafeDiskPath(projectId, relativePath);
  const dir = path.dirname(fullPath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(fullPath, content);
  const root = getStorageRoot();
  const relativeDisk = path.relative(root, fullPath).replace(/\\/g, "/");
  return { diskPath: relativeDisk, sizeBytes: content.byteLength };
}

export async function readDiskFile(
  projectId: number,
  relativePath: string,
): Promise<Buffer | null> {
  try {
    const fullPath = getSafeDiskPath(projectId, relativePath);
    return await fs.readFile(fullPath);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function diskFileExists(
  projectId: number,
  relativePath: string,
): Promise<boolean> {
  try {
    const fullPath = getSafeDiskPath(projectId, relativePath);
    const stat = await fs.stat(fullPath);
    return stat.isFile();
  } catch {
    return false;
  }
}

export async function deleteDiskFile(
  projectId: number,
  relativePath: string,
  isPrefix = false,
): Promise<boolean> {
  try {
    const fullPath = getSafeDiskPath(projectId, relativePath);
    if (isPrefix) {
      await fs.rm(fullPath, { recursive: true, force: true });
    } else {
      await fs.unlink(fullPath);
    }
    return true;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return false;
    }
    return false;
  }
}
