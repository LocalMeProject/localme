/**
 * Minimal store-only ZIP builder (Blueprint §4.3 backup/export: "ZIP export
 * over file_blobs"). No compression — the stored bytes go in verbatim, which
 * keeps both dialects' blob reads byte-exact and needs no dependencies.
 * CRC-32 is the standard Ethernet polynomial implemented in ~10 lines.
 */
import { inflateRawSync } from "node:zlib";

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  path: string;
  content: Buffer;
  /** DOS timestamp field (seconds/2 packed); 0 = 1980-01-01 is acceptable. */
  modified?: Date;
}

/** Hard ceiling on one entry's inflated size (deflate can expand ~1000x). */
const DEFAULT_MAX_ENTRY_BYTES = 64 * 1024 * 1024;

/**
 * Read a ZIP archive produced by this module (or any store/deflate archiver).
 * Parses the central directory, then resolves each entry's local header so
 * UTF-8 names and both supported methods (0 = store, 8 = deflate) work.
 *
 * `maxEntryBytes` bounds a single inflated entry, and every offset is validated
 * against the buffer, so a hostile archive cannot read out of bounds or expand
 * without limit.
 */
export function readZip(archive: Buffer, options: { maxEntryBytes?: number } = {}): ZipEntry[] {
  const maxEntryBytes = options.maxEntryBytes ?? DEFAULT_MAX_ENTRY_BYTES;
  const eocd = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("Not a ZIP archive.");
  const count = archive.readUInt16LE(eocd + 10);
  let cursor = archive.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];

  for (let i = 0; i < count; i++) {
    if (cursor + 46 > archive.length || archive.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error("Corrupt ZIP central directory.");
    }
    const method = archive.readUInt16LE(cursor + 10);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const nameLen = archive.readUInt16LE(cursor + 28);
    const extraLen = archive.readUInt16LE(cursor + 30);
    const commentLen = archive.readUInt16LE(cursor + 32);
    const localOffset = archive.readUInt32LE(cursor + 42);
    const path = archive.subarray(cursor + 46, cursor + 46 + nameLen).toString("utf8");

    if (localOffset + 30 > archive.length || archive.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error("Corrupt ZIP local header.");
    }
    const localNameLen = archive.readUInt16LE(localOffset + 26);
    const localExtraLen = archive.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    if (dataStart + compressedSize > archive.length) throw new Error("Truncated ZIP entry.");
    const raw = archive.subarray(dataStart, dataStart + compressedSize);
    const content =
      method === 0
        ? Buffer.from(raw)
        : inflateRawSync(Buffer.from(raw), { maxOutputLength: maxEntryBytes });

    entries.push({ path, content });
    cursor += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/**
 * Build a ZIP-2.0 archive from entries. Local file headers + central
 * directory, store method (no compression), UTF-8 names.
 */
export function buildZip(entries: ZipEntry[]): Buffer {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.path, "utf8");
    const crc = crc32(entry.content);
    const size = entry.content.byteLength;
    const when = entry.modified ?? new Date(0);
    const dosTime =
      ((when.getUTCHours() & 0x1f) << 11) |
      ((when.getUTCMinutes() & 0x3f) << 5) |
      ((Math.floor(when.getUTCSeconds() / 2)) & 0x1f);
    const dosDate =
      (((Math.max(when.getUTCFullYear(), 1980) - 1980) & 0x7f) << 9) |
      (((when.getUTCMonth() + 1) & 0x0f) << 5) |
      (when.getUTCDate() & 0x1f);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // flags: UTF-8 names
    local.writeUInt16LE(0, 8); // method: store
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18); // compressed == stored
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);

    chunks.push(local, nameBytes, entry.content);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0); // central directory signature
    dir.writeUInt16LE(20, 4); // version made by
    dir.writeUInt16LE(20, 6); // version needed
    dir.writeUInt16LE(0x0800, 8);
    dir.writeUInt16LE(0, 10);
    dir.writeUInt16LE(dosTime, 12);
    dir.writeUInt16LE(dosDate, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(size, 20);
    dir.writeUInt32LE(size, 24);
    dir.writeUInt16LE(nameBytes.length, 28);
    // extra/comment/disk/attrs = 0
    dir.writeUInt32LE(offset, 42);

    central.push(Buffer.concat([dir, nameBytes]));
    offset += 30 + nameBytes.length + size;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...chunks, centralBuf, end]);
}
