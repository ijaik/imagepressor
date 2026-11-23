import type { ImageMetadata } from "./types";
export type JpegMetadata = ImageMetadata;
export type { ImageMetadata };
const METADATA_WINDOW_SIZE = 256 * 1024;
const EXIF_PREFIX = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
export type MetadataEntryKind =
  "jpeg-app1" | "jpeg-app2" | "webp-exif" | "webp-iccp";
export interface MetadataEntry {
  kind: MetadataEntryKind;
  /**
   * JPEG entries hold the full APPn segment (marker + length + payload).
   * WebP entries hold the raw chunk payload (no fourCC, no chunk size).
   */
  bytes: Uint8Array;
}
function hasExifPrefix(bytes: Uint8Array, offset = 0): boolean {
  if (bytes.length < offset + EXIF_PREFIX.length) return false;
  for (let i = 0; i < EXIF_PREFIX.length; i++)
    if (bytes[offset + i] !== EXIF_PREFIX[i]) return false;
  return true;
}
function toDataView(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}
function copyWindowBytes(
  view: DataView,
  start: number,
  end: number,
): Uint8Array {
  return new Uint8Array(
    view.buffer.slice(view.byteOffset + start, view.byteOffset + end),
  );
}
/**
 * Walks JPEG APPn segments. When a segment extends past the 256 KB window the
 * header is still read, the segment is sliced directly from the file, and the
 * walk re-slices at the next offset — so long APP chains are not truncated.
 */
async function* walkJpeg(
  fileOrBlob: Blob,
  initialView: DataView,
): AsyncGenerator<MetadataEntry> {
  let base = 0;
  let view = initialView;
  let offset = 2;
  while (true) {
    if (offset + 4 > view.byteLength) {
      const nextBase = base + offset;
      if (nextBase + 4 > fileOrBlob.size) return;
      const buffer = await fileOrBlob
        .slice(nextBase, nextBase + METADATA_WINDOW_SIZE)
        .arrayBuffer();
      if (buffer.byteLength < 4) return;
      base = nextBase;
      view = new DataView(buffer);
      offset = 0;
      continue;
    }
    const marker = view.getUint16(offset);
    if (marker === 0xffda || marker === 0xffd9 || (marker & 0xff00) !== 0xff00)
      return;
    const segLength = view.getUint16(offset + 2);
    if (segLength < 2) return;
    const segmentEnd = offset + 2 + segLength;
    const absoluteEnd = base + segmentEnd;
    if (absoluteEnd > fileOrBlob.size) return;
    // Preserve APP1 (0xFFE1: Exif / XMP) and APP2 (0xFFE2: ICC color profile)
    if (marker === 0xffe1 || marker === 0xffe2) {
      const bytes =
        segmentEnd <= view.byteLength
          ? copyWindowBytes(view, offset, segmentEnd)
          : new Uint8Array(
              await fileOrBlob.slice(base + offset, absoluteEnd).arrayBuffer(),
            );
      yield {
        kind: marker === 0xffe1 ? "jpeg-app1" : "jpeg-app2",
        bytes,
      };
    }
    offset = segmentEnd;
  }
}
/**
 * Walks WebP RIFF chunks using chunk-hopping, reading 8-byte headers (and only
 * the metadata payloads) so multi-megabyte pixel frames are never loaded.
 */
async function* walkWebp(
  fileOrBlob: Blob,
  initialView: DataView,
): AsyncGenerator<MetadataEntry> {
  const fileSize = fileOrBlob.size;
  let offset = 12;
  while (offset + 8 <= fileSize) {
    let fourCC: number;
    let chunkDataSize: number;
    if (offset + 8 <= initialView.byteLength) {
      fourCC = initialView.getUint32(offset, false);
      chunkDataSize = initialView.getUint32(offset + 4, true);
    } else {
      const headerBuf = await fileOrBlob
        .slice(offset, offset + 8)
        .arrayBuffer();
      if (headerBuf.byteLength < 8) return;
      const headerView = new DataView(headerBuf);
      fourCC = headerView.getUint32(0, false);
      chunkDataSize = headerView.getUint32(4, true);
    }
    const paddedSize = (chunkDataSize + 1) & ~1;
    const isExif = fourCC === 0x45584946;
    const isIcc = fourCC === 0x49434350;
    if ((isExif && chunkDataSize >= 6) || isIcc) {
      const dataEnd = offset + 8 + chunkDataSize;
      if (dataEnd > fileSize) return;
      if (chunkDataSize > 0) {
        const bytes = new Uint8Array(
          await fileOrBlob.slice(offset + 8, dataEnd).arrayBuffer(),
        );
        yield { kind: isExif ? "webp-exif" : "webp-iccp", bytes };
      }
    }
    offset += 8 + paddedSize;
  }
}
/**
 * Single traversal used by both `extractMetadataSegments` and
 * `getImageMetadata`, so parser fixes only ever need to be made once.
 */
async function* walkMetadata(fileOrBlob: Blob): AsyncGenerator<MetadataEntry> {
  const windowSize = Math.min(fileOrBlob.size, METADATA_WINDOW_SIZE);
  const buffer = await fileOrBlob.slice(0, windowSize).arrayBuffer();
  const view = new DataView(buffer);
  if (view.byteLength < 4) return;
  // Case 1: JPEG (SOI 0xFFD8)
  if (view.getUint16(0) === 0xffd8) {
    yield* walkJpeg(fileOrBlob, view);
    return;
  }
  // Case 2: WebP ('RIFF'....'WEBP')
  if (
    view.byteLength >= 12 &&
    view.getUint32(0, false) === 0x52494646 &&
    view.getUint32(8, false) === 0x57454250
  )
    yield* walkWebp(fileOrBlob, view);
}
function wrapExifAsApp1(chunkData: Uint8Array): Uint8Array {
  const tiffBytes = hasExifPrefix(chunkData)
    ? chunkData.subarray(EXIF_PREFIX.length)
    : chunkData;
  // 0xFFE1 + len + 'Exif\0\0' + TIFF
  const app1Length = 2 + EXIF_PREFIX.length + tiffBytes.length;
  const app1 = new Uint8Array(2 + app1Length);
  app1[0] = 0xff;
  app1[1] = 0xe1;
  app1[2] = (app1Length >> 8) & 0xff;
  app1[3] = app1Length & 0xff;
  app1.set(EXIF_PREFIX, 4);
  app1.set(tiffBytes, 4 + EXIF_PREFIX.length);
  return app1;
}
function wrapIccAsApp2(iccBytes: Uint8Array): Uint8Array {
  // 0xFFE2 + len + 'ICC_PROFILE\0' + seq + count + ICC
  const iccHeader = [
    0x49, 0x43, 0x43, 0x5f, 0x50, 0x52, 0x4f, 0x46, 0x49, 0x4c, 0x45, 0x00,
    0x01, 0x01,
  ];
  const app2Length = 2 + iccHeader.length + iccBytes.length;
  const app2 = new Uint8Array(2 + app2Length);
  app2[0] = 0xff;
  app2[1] = 0xe2;
  app2[2] = (app2Length >> 8) & 0xff;
  app2[3] = app2Length & 0xff;
  app2.set(iccHeader, 4);
  app2.set(iccBytes, 4 + iccHeader.length);
  return app2;
}
/**
 * Extracts raw EXIF (APP1 / RIFF EXIF) and ICC Profile (APP2 / RIFF ICCP)
 * metadata segments from a JPEG or WebP file, normalized to JPEG APP segments.
 * EXIF orientation is normalized to 1 on the returned copy.
 */
export async function extractMetadataSegments(
  fileOrBlob: Blob,
): Promise<Uint8Array[]> {
  const segments: Uint8Array[] = [];
  for await (const entry of walkMetadata(fileOrBlob)) {
    switch (entry.kind) {
      case "jpeg-app1": {
        normalizeExifOrientation(entry.bytes);
        segments.push(entry.bytes);
        break;
      }
      case "jpeg-app2": {
        segments.push(entry.bytes);
        break;
      }
      case "webp-exif": {
        const app1 = wrapExifAsApp1(entry.bytes);
        normalizeExifOrientation(app1);
        segments.push(app1);
        break;
      }
      case "webp-iccp": {
        segments.push(wrapIccAsApp2(entry.bytes));
        break;
      }
    }
  }
  return segments;
}
/**
 * Normalizes the EXIF Orientation tag to 1 (normal / top-left) in place.
 */
export function normalizeExifOrientation(segment: Uint8Array): boolean {
  if (segment.length < 14) return false;
  const isExif =
    segment[0] === 0xff &&
    segment[1] === 0xe1 &&
    segment[4] === 0x45 &&
    segment[5] === 0x78 &&
    segment[6] === 0x69 &&
    segment[7] === 0x66 &&
    segment[8] === 0x00 &&
    segment[9] === 0x00;
  if (!isExif) return false;
  const tiffStart = 10;
  const view = new DataView(
    segment.buffer,
    segment.byteOffset,
    segment.byteLength,
  );
  const isLittleEndian = view.getUint16(tiffStart) === 0x4949;
  if (!isLittleEndian && view.getUint16(tiffStart) !== 0x4d4d) return false;
  if (view.getUint16(tiffStart + 2, isLittleEndian) !== 0x002a) return false;
  const firstIfdOffset = view.getUint32(tiffStart + 4, isLittleEndian);
  const ifdStart = tiffStart + firstIfdOffset;
  if (ifdStart + 2 > segment.length) return false;
  const tagCount = view.getUint16(ifdStart, isLittleEndian);
  for (let i = 0; i < tagCount; i++) {
    const entryOffset = ifdStart + 2 + i * 12;
    if (entryOffset + 12 > segment.length) break;
    const tagId = view.getUint16(entryOffset, isLittleEndian);
    if (tagId === 0x0112) {
      view.setUint16(entryOffset + 8, 1, isLittleEndian);
      return true;
    }
  }
  return false;
}
/**
 * Injects raw original metadata segments into a canvas-compressed JPEG blob.
 */
export async function spliceMetadataIntoBlob(
  compressedBlob: Blob,
  metadataSegments: Uint8Array[],
): Promise<Blob> {
  if (metadataSegments.length === 0) return compressedBlob;
  const headBuffer = await compressedBlob.slice(0, 32).arrayBuffer();
  const headView = new DataView(headBuffer);
  if (headView.byteLength < 4 || headView.getUint16(0) !== 0xffd8)
    return compressedBlob;
  let startOffset = 2; // After SOI (0xFFD8)
  if (headView.getUint16(2) === 0xffe0) {
    const jfifLen = headView.getUint16(4);
    startOffset = 4 + jfifLen;
  }
  const headerPart = compressedBlob.slice(0, startOffset);
  const bodyPart = compressedBlob.slice(startOffset);
  const segmentBuffers: BlobPart[] = metadataSegments.map(
    (s) =>
      s.buffer.slice(s.byteOffset, s.byteOffset + s.byteLength) as ArrayBuffer,
  );
  return new Blob([headerPart, ...segmentBuffers, bodyPart], {
    type: compressedBlob.type || "image/jpeg",
  });
}
/**
 * Inspects raw JPEG or WebP markers/chunks to extract camera info, orientation, and
 * whether an ICC color profile is embedded.
 */
export async function getImageMetadata(
  fileOrBlob: Blob,
): Promise<ImageMetadata> {
  const result: ImageMetadata = {
    hasExif: false,
    hasIccProfile: false,
    colorSpace: "sRGB (Standard)",
  };
  for await (const entry of walkMetadata(fileOrBlob)) {
    if (entry.kind === "jpeg-app1") {
      if (hasExifPrefix(entry.bytes, 4)) {
        result.hasExif = true;
        parseExifTiff(toDataView(entry.bytes), 10, result);
      }
    } else if (entry.kind === "webp-exif") {
      result.hasExif = true;
      parseExifTiff(
        toDataView(entry.bytes),
        hasExifPrefix(entry.bytes) ? EXIF_PREFIX.length : 0,
        result,
      );
    } else {
      // JPEG APP2 or WebP ICCP: a profile is embedded, but its color space
      // cannot be assumed from the transport marker alone.
      result.hasIccProfile = true;
      result.colorSpace = "ICC profile embedded";
    }
  }
  return result;
}
export const getJpegMetadata = getImageMetadata;
function parseExifTiff(view: DataView, tiffStart: number, out: ImageMetadata) {
  if (tiffStart + 8 > view.byteLength) return;
  const isLittleEndian = view.getUint16(tiffStart) === 0x4949;
  if (!isLittleEndian && view.getUint16(tiffStart) !== 0x4d4d) return;
  if (view.getUint16(tiffStart + 2, isLittleEndian) !== 0x002a) return;
  const firstIfdOffset = view.getUint32(tiffStart + 4, isLittleEndian);
  const ifdStart = tiffStart + firstIfdOffset;
  if (ifdStart + 2 > view.byteLength) return;
  let exifSubIfdOffset: number | undefined;
  const tagCount = view.getUint16(ifdStart, isLittleEndian);
  for (let i = 0; i < tagCount; i++) {
    const entryOffset = ifdStart + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) break;
    const tagId = view.getUint16(entryOffset, isLittleEndian);
    const type = view.getUint16(entryOffset + 2, isLittleEndian);
    const count = view.getUint32(entryOffset + 4, isLittleEndian);
    if (tagId === 0x0112)
      out.orientation = view.getUint16(entryOffset + 8, isLittleEndian);
    else if (tagId === 0x010f && type === 2)
      out.make = readAscii(view, tiffStart, entryOffset, count, isLittleEndian);
    else if (tagId === 0x0110 && type === 2)
      out.model = readAscii(
        view,
        tiffStart,
        entryOffset,
        count,
        isLittleEndian,
      );
    else if (tagId === 0x0132 && type === 2)
      out.dateTime = readAscii(
        view,
        tiffStart,
        entryOffset,
        count,
        isLittleEndian,
      );
    else if (tagId === 0x8769 && (type === 3 || type === 4))
      exifSubIfdOffset = view.getUint32(entryOffset + 8, isLittleEndian); // Exif IFD Pointer
  }
  // If dateTime not in IFD0, check Exif Sub-IFD for DateTimeOriginal (0x9003) or DateTimeDigitized (0x9004)
  if (exifSubIfdOffset) {
    const subIfdStart = tiffStart + exifSubIfdOffset;
    if (subIfdStart + 2 <= view.byteLength) {
      const subTagCount = view.getUint16(subIfdStart, isLittleEndian);
      for (let i = 0; i < subTagCount; i++) {
        const entryOffset = subIfdStart + 2 + i * 12;
        if (entryOffset + 12 > view.byteLength) break;
        const tagId = view.getUint16(entryOffset, isLittleEndian);
        const type = view.getUint16(entryOffset + 2, isLittleEndian);
        const count = view.getUint32(entryOffset + 4, isLittleEndian);
        if (
          (tagId === 0x9003 || tagId === 0x9004) &&
          type === 2 &&
          !out.dateTime
        )
          out.dateTime = readAscii(
            view,
            tiffStart,
            entryOffset,
            count,
            isLittleEndian,
          );
      }
    }
  }
}
function readAscii(
  view: DataView,
  tiffStart: number,
  entryOffset: number,
  count: number,
  isLittleEndian: boolean,
): string {
  if (count <= 4) {
    let str = "";
    for (let j = 0; j < count; j++) {
      const charCode = view.getUint8(entryOffset + 8 + j);
      if (charCode === 0) break;
      str += String.fromCharCode(charCode);
    }
    return str.trim();
  }
  const offsetVal = view.getUint32(entryOffset + 8, isLittleEndian);
  const valueOffset = tiffStart + offsetVal;
  if (valueOffset >= view.byteLength) return "";
  const maxLen = Math.min(count, view.byteLength - valueOffset);
  let str = "";
  for (let j = 0; j < maxLen; j++) {
    const charCode = view.getUint8(valueOffset + j);
    if (charCode === 0) break;
    str += String.fromCharCode(charCode);
  }
  return str.trim();
}
