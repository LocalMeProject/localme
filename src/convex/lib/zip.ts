/**
 * Minimal ZIP writer/reader using the "stored" (uncompressed) method.
 *
 * The specification describes ZIP archives for full-project export/import
 * (`storage/`, `lib/`, `config/config.json`, `config/secrets.json`). This
 * runtime ships no zlib binding, so archives are written uncompressed — every
 * standard unzip implementation reads them, and the platform reads its own
 * exports back losslessly.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export type ZipEntry = { path: string; data: Uint8Array };

type Chunk = { header: Uint8Array; data: Uint8Array };

export function createZip(entries: ZipEntry[]): Uint8Array {
  const now = new Date();
  const dosTime =
    ((now.getHours() & 0x1f) << 11) | ((now.getMinutes() & 0x3f) << 5) | ((now.getSeconds() / 2) & 0x1f);
  const dosDate = (((now.getFullYear() - 1980) & 0x7f) << 9) | (((now.getMonth() + 1) & 0x0f) << 5) | (now.getDate() & 0x1f);

  const chunks: Chunk[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = utf8(entry.path);
    const crc = crc32(entry.data);
    const header = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true); // version needed
    view.setUint16(6, 0, true); // flags
    view.setUint16(8, 0, true); // method: stored
    view.setUint16(10, dosTime, true);
    view.setUint16(12, dosDate, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, entry.data.length, true);
    view.setUint32(22, entry.data.length, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);
    header.set(nameBytes, 30);
    chunks.push({ header, data: entry.data });

    const record = new Uint8Array(46 + nameBytes.length);
    const recordView = new DataView(record.buffer);
    recordView.setUint32(0, 0x02014b50, true);
    recordView.setUint16(4, 20, true);
    recordView.setUint16(6, 20, true);
    recordView.setUint16(8, 0, true);
    recordView.setUint16(10, 0, true);
    recordView.setUint16(12, dosTime, true);
    recordView.setUint16(14, dosDate, true);
    recordView.setUint32(16, crc, true);
    recordView.setUint32(20, entry.data.length, true);
    recordView.setUint32(24, entry.data.length, true);
    recordView.setUint16(28, nameBytes.length, true);
    recordView.setUint16(30, 0, true);
    recordView.setUint16(32, 0, true);
    recordView.setUint16(34, 0, true);
    recordView.setUint16(36, 0, true);
    recordView.setUint32(38, 0, true);
    recordView.setUint32(42, offset, true);
    record.set(nameBytes, 46);
    central.push(record);

    offset += header.length + entry.data.length;
  }

  const centralSize = central.reduce((total, record) => total + record.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  const total =
    chunks.reduce((sum, chunk) => sum + chunk.header.length + chunk.data.length, 0) + centralSize + end.length;
  const output = new Uint8Array(total);
  let cursor = 0;
  for (const chunk of chunks) {
    output.set(chunk.header, cursor);
    cursor += chunk.header.length;
    output.set(chunk.data, cursor);
    cursor += chunk.data.length;
  }
  for (const record of central) {
    output.set(record, cursor);
    cursor += record.length;
  }
  output.set(end, cursor);
  return output;
}

/** Reads an archive produced by {@link createZip}. */
export function readZip(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries: ZipEntry[] = [];
  let cursor = 0;
  while (cursor + 30 <= bytes.length) {
    const signature = view.getUint32(cursor, true);
    if (signature !== 0x04034b50) break;
    const method = view.getUint16(cursor + 8, true);
    const compressedSize = view.getUint32(cursor + 18, true);
    const nameLength = view.getUint16(cursor + 26, true);
    const extraLength = view.getUint16(cursor + 28, true);
    const nameStart = cursor + 30;
    const path = new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLength));
    const dataStart = nameStart + nameLength + extraLength;
    if (method !== 0) {
      throw new Error(
        `Archive entry "${path}" uses compression method ${method}; LocalMe imports uncompressed archives.`,
      );
    }
    entries.push({ path, data: bytes.subarray(dataStart, dataStart + compressedSize) });
    cursor = dataStart + compressedSize;
  }
  if (entries.length === 0) throw new Error("Archive contains no readable entries");
  return entries;
}
