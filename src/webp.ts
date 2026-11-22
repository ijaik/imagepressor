const RIFF_HEADER_SIZE = 12;
const VP8X_PAYLOAD_SIZE = 10;
const MAX_RIFF_SIZE = 0xffff_ffff;

export const EXIF_FLAG = 0x08;
export const ALPHA_FLAG = 0x10;
export const ICCP_FLAG = 0x20;
export const XMP_FLAG = 0x04;
export const ANIMATION_FLAG = 0x02;

export interface WebPChunk {
  fourCC: string;
  data: Uint8Array;
}

function readFourCC(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    bytes[offset],
    bytes[offset + 1],
    bytes[offset + 2],
    bytes[offset + 3],
  );
}

function readU32(bytes: Uint8Array, offset: number): number {
  return new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).getUint32(offset, true);
}

function writeU32(bytes: Uint8Array, offset: number, value: number): void {
  new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).setUint32(offset, value, true);
}

function readU24(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16)
  );
}

function writeU24(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
}

export function parseChunks(bytes: Uint8Array): WebPChunk[] {
  if (bytes.length < RIFF_HEADER_SIZE) {
    throw new Error("Invalid WebP: file is too small");
  }

  if (
    readFourCC(bytes, 0) !== "RIFF" ||
    readFourCC(bytes, 8) !== "WEBP"
  ) {
    throw new Error("Invalid WebP: missing RIFF/WEBP header");
  }

  const riffSize = readU32(bytes, 4);
  // Allow ±1 byte difference for trailing padding variations across browsers
  if (Math.abs(riffSize + 8 - bytes.length) > 1 && riffSize + 8 > bytes.length) {
    throw new Error("Invalid WebP: RIFF size mismatch");
  }

  const chunks: WebPChunk[] = [];
  let offset = RIFF_HEADER_SIZE;

  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) {
      break;
    }

    const fourCC = readFourCC(bytes, offset);
    const chunkSize = readU32(bytes, offset + 4);

    const dataStart = offset + 8;
    const dataEnd = dataStart + chunkSize;
    const paddedEnd = dataEnd + (chunkSize & 1);

    if (dataEnd > bytes.length) {
      break;
    }

    chunks.push({
      fourCC,
      data: bytes.subarray(dataStart, dataEnd),
    });

    offset = Math.min(paddedEnd, bytes.length);
  }

  return chunks;
}

export function getImageDimensions(
  chunks: WebPChunk[],
): { width: number; height: number; alpha: boolean } {
  // If VP8X is present, read dimensions from it
  const vp8x = chunks.find((c) => c.fourCC === "VP8X");
  if (vp8x && vp8x.data.length >= 10) {
    const width = 1 + readU24(vp8x.data, 4);
    const height = 1 + readU24(vp8x.data, 7);
    const alpha = (vp8x.data[0] & ALPHA_FLAG) !== 0;
    return { width, height, alpha };
  }

  const vp8 = chunks.find((chunk) => chunk.fourCC === "VP8 ");
  const vp8l = chunks.find((chunk) => chunk.fourCC === "VP8L");

  if (vp8) {
    const data = vp8.data;
    if (
      data.length >= 10 &&
      data[3] === 0x9d &&
      data[4] === 0x01 &&
      data[5] === 0x2a
    ) {
      const width = (data[6] | (data[7] << 8)) & 0x3fff;
      const height = (data[8] | (data[9] << 8)) & 0x3fff;
      if (width && height) {
        return { width, height, alpha: false };
      }
    }
  }

  if (vp8l) {
    const data = vp8l.data;
    if (data.length >= 5 && data[0] === 0x2f) {
      const bits =
        data[1] |
        (data[2] << 8) |
        (data[3] << 16) |
        (data[4] << 24);
      const width = (bits & 0x3fff) + 1;
      const height = ((bits >>> 14) & 0x3fff) + 1;
      const alpha = ((bits >>> 28) & 1) !== 0;
      return { width, height, alpha };
    }
  }

  return { width: 1, height: 1, alpha: false };
}

/**
 * Creates a VP8X extended chunk preserving image features.
 */
export function createVP8X(
  chunks: WebPChunk[],
  exif: boolean,
  icc: boolean,
  fallbackWidth?: number,
  fallbackHeight?: number,
): WebPChunk {
  let { width, height, alpha } = getImageDimensions(chunks);
  if (fallbackWidth && (!width || width === 1)) width = fallbackWidth;
  if (fallbackHeight && (!height || height === 1)) height = fallbackHeight;

  let flags = 0;
  if (exif) flags |= EXIF_FLAG;
  if (icc || chunks.some((c) => c.fourCC === "ICCP")) flags |= ICCP_FLAG;
  if (alpha || chunks.some((c) => c.fourCC === "ALPH")) flags |= ALPHA_FLAG;
  if (chunks.some((c) => c.fourCC === "XMP ")) flags |= XMP_FLAG;
  if (chunks.some((c) => c.fourCC === "ANIM" || c.fourCC === "ANMF")) {
    flags |= ANIMATION_FLAG;
  }

  const data = new Uint8Array(VP8X_PAYLOAD_SIZE);
  data[0] = flags;
  writeU24(data, 4, Math.max(0, width - 1));
  writeU24(data, 7, Math.max(0, height - 1));

  return {
    fourCC: "VP8X",
    data,
  };
}

/**
 * Strips JPEG APP1 markers and "Exif\0\0" identifiers, ensuring the EXIF payload
 * begins directly with a valid TIFF header (II or MM) as required by the WebP specification.
 */
export function normalizeExif(exif: Uint8Array): Uint8Array {
  if (exif.length === 0) {
    throw new Error("EXIF data cannot be empty");
  }

  let data = exif;
  // If passed a full JPEG APP1 segment (0xFFE1 + 2 bytes length)
  if (data.length >= 4 && data[0] === 0xff && data[1] === 0xe1) {
    data = data.subarray(4);
  }

  // Remove JPEG "Exif\0\0" identifier if present
  const hasExifPrefix =
    data.length >= 6 &&
    data[0] === 0x45 &&
    data[1] === 0x78 &&
    data[2] === 0x69 &&
    data[3] === 0x66 &&
    data[4] === 0x00 &&
    data[5] === 0x00;

  const result = hasExifPrefix ? data.subarray(6) : data;

  if (result.length < 8) {
    throw new Error("Invalid EXIF TIFF header");
  }

  const littleEndian = result[0] === 0x49 && result[1] === 0x49;
  const bigEndian = result[0] === 0x4d && result[1] === 0x4d;

  if (!littleEndian && !bigEndian) {
    throw new Error("Invalid EXIF byte order");
  }

  const magic = littleEndian
    ? result[2] | (result[3] << 8)
    : (result[2] << 8) | result[3];

  if (magic !== 42) {
    throw new Error("Invalid EXIF TIFF magic");
  }

  return result;
}

/**
 * Strips JPEG APP2 markers and "ICC_PROFILE\0" headers to return raw ICC data.
 */
export function normalizeIcc(icc: Uint8Array): Uint8Array {
  let data = icc;
  // JPEG APP2 segment: marker (2) + length (2)
  if (data.length >= 4 && data[0] === 0xff && data[1] === 0xe2) {
    data = data.subarray(4);
  }

  // 'ICC_PROFILE\0' (12 bytes) + seq (1) + count (1) = 14 bytes
  if (
    data.length >= 14 &&
    data[0] === 0x49 && // 'I'
    data[1] === 0x43 && // 'C'
    data[2] === 0x43 && // 'C'
    data[3] === 0x5f && // '_'
    data[4] === 0x50 && // 'P'
    data[5] === 0x52 && // 'R'
    data[6] === 0x4f && // 'O'
    data[7] === 0x46 && // 'F'
    data[8] === 0x49 && // 'I'
    data[9] === 0x4c && // 'L'
    data[10] === 0x45 && // 'E'
    data[11] === 0x00
  ) {
    return data.subarray(14);
  }

  return data;
}

export function serializeChunks(chunks: WebPChunk[]): Uint8Array {
  let totalSize = RIFF_HEADER_SIZE;

  for (const chunk of chunks) {
    totalSize += 8 + chunk.data.length + (chunk.data.length & 1);
  }

  if (totalSize - 8 > MAX_RIFF_SIZE) {
    throw new Error("WebP file exceeds RIFF size limit");
  }

  const output = new Uint8Array(totalSize);

  output.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  writeU32(output, 4, totalSize - 8);
  output.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP

  let offset = RIFF_HEADER_SIZE;

  for (const chunk of chunks) {
    for (let i = 0; i < 4; i++) {
      output[offset + i] = chunk.fourCC.charCodeAt(i);
    }

    writeU32(output, offset + 4, chunk.data.length);
    output.set(chunk.data, offset + 8);
    offset += 8 + chunk.data.length;

    if (chunk.data.length & 1) {
      output[offset] = 0;
      offset++;
    }
  }

  return output;
}

/**
 * Attaches or replaces EXIF and ICC metadata in a WebP file without re-encoding pixels.
 */
export function insertWebPExif(
  webp: Uint8Array,
  rawExif?: Uint8Array,
  rawIcc?: Uint8Array,
  fallbackWidth?: number,
  fallbackHeight?: number,
): Uint8Array {
  if (!(webp instanceof Uint8Array)) {
    throw new TypeError("webp must be a Uint8Array");
  }

  const exifData = rawExif ? normalizeExif(rawExif) : undefined;
  const iccData = rawIcc ? normalizeIcc(rawIcc) : undefined;

  let chunks = parseChunks(webp);
  const vp8xIndex = chunks.findIndex((c) => c.fourCC === "VP8X");

  if (vp8xIndex !== -1) {
    const vp8x = chunks[vp8xIndex];
    const updated = vp8x.data.slice();
    if (exifData) updated[0] |= EXIF_FLAG;
    if (iccData) updated[0] |= ICCP_FLAG;
    chunks[vp8xIndex] = { fourCC: "VP8X", data: updated };
  } else {
    const vp8x = createVP8X(chunks, Boolean(exifData), Boolean(iccData), fallbackWidth, fallbackHeight);
    chunks = [vp8x, ...chunks];
  }

  // Remove existing EXIF/ICCP to avoid duplicates
  if (exifData) {
    chunks = chunks.filter((c) => c.fourCC !== "EXIF");
  }
  if (iccData) {
    chunks = chunks.filter((c) => c.fourCC !== "ICCP");
  }

  // Position ICCP immediately after VP8X
  if (iccData) {
    const insertIdx = chunks.findIndex((c) => c.fourCC === "VP8X") + 1;
    chunks.splice(insertIdx, 0, { fourCC: "ICCP", data: iccData });
  }

  // Append EXIF after image frames
  if (exifData) {
    chunks.push({ fourCC: "EXIF", data: exifData });
  }

  return serializeChunks(chunks);
}

/**
 * Splices raw metadata segments (JPEG APP1/APP2) into a canvas-compressed WebP Blob.
 */
export async function spliceWebpMetadata(
  webpBlob: Blob,
  metadataSegments: Uint8Array[],
  width?: number,
  height?: number,
): Promise<Blob> {
  let rawExif: Uint8Array | undefined;
  let rawIcc: Uint8Array | undefined;

  for (const seg of metadataSegments) {
    if (seg.length >= 14 && seg[0] === 0xff && seg[1] === 0xe1) {
      rawExif = seg;
    } else if (seg.length >= 18 && seg[0] === 0xff && seg[1] === 0xe2) {
      rawIcc = seg;
    }
  }

  if (!rawExif && !rawIcc) {
    return webpBlob;
  }

  const webpBytes = new Uint8Array(await webpBlob.arrayBuffer());
  const resultBytes = insertWebPExif(webpBytes, rawExif, rawIcc, width, height);

  return new Blob([resultBytes.buffer.slice(0, resultBytes.byteLength) as ArrayBuffer], {
    type: "image/webp",
  });
}
