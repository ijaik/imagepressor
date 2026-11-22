import type { ImageMetadata } from "./types";

export type JpegMetadata = ImageMetadata;
export type { ImageMetadata };

/**
 * Extracts raw EXIF (APP1, 0xFFE1 / RIFF EXIF) and ICC Profile (APP2, 0xFFE2 / RIFF ICCP) metadata segments
 * from a JPEG or WebP file.
 * Traverses RIFF chunks using chunk-hopping to bypass pixel payload without loading full images into RAM.
 */
export async function extractMetadataSegments(
  fileOrBlob: Blob,
): Promise<Uint8Array[]> {
  const chunkSize = Math.min(fileOrBlob.size, 256 * 1024);
  const buffer = await fileOrBlob.slice(0, chunkSize).arrayBuffer();
  const view = new DataView(buffer);
  if (view.byteLength < 4) return [];

  // Case 1: JPEG (SOI 0xFFD8)
  if (view.getUint16(0) === 0xffd8) {
    const segments: Uint8Array[] = [];
    let offset = 2;

    while (offset + 4 < view.byteLength) {
      const marker = view.getUint16(offset);
      if (
        marker === 0xffda ||
        marker === 0xffd9 ||
        (marker & 0xff00) !== 0xff00
      ) {
        break;
      }

      const segLength = view.getUint16(offset + 2);
      if (segLength < 2 || offset + 2 + segLength > view.byteLength) break;

      // Preserve APP1 (0xFFE1: Exif / XMP) and APP2 (0xFFE2: ICC color profile)
      if (marker === 0xffe1 || marker === 0xffe2) {
        const segBytes = new Uint8Array(
          buffer.slice(offset, offset + 2 + segLength),
        );
        normalizeExifOrientation(segBytes);
        segments.push(segBytes);
      }

      offset += 2 + segLength;
    }

    return segments;
  }

  // Case 2: WebP ('RIFF'....'WEBP')
  if (
    view.byteLength >= 12 &&
    view.getUint32(0, false) === 0x52494646 &&
    view.getUint32(8, false) === 0x57454250
  ) {
    const segments: Uint8Array[] = [];
    let offset = 12;
    const fileSize = fileOrBlob.size;

    while (offset + 8 <= fileSize) {
      let fourCC: number;
      let chunkDataSize: number;

      if (offset + 8 <= view.byteLength) {
        fourCC = view.getUint32(offset, false);
        chunkDataSize = view.getUint32(offset + 4, true);
      } else {
        const headerBuf = await fileOrBlob.slice(offset, offset + 8).arrayBuffer();
        if (headerBuf.byteLength < 8) break;
        const headerView = new DataView(headerBuf);
        fourCC = headerView.getUint32(0, false);
        chunkDataSize = headerView.getUint32(4, true);
      }

      const paddedSize = (chunkDataSize + 1) & ~1;

      // 'EXIF' (0x45584946)
      if (fourCC === 0x45584946 && chunkDataSize >= 6) {
        const exifBuf = await fileOrBlob
          .slice(offset + 8, offset + 8 + chunkDataSize)
          .arrayBuffer();
        const rawBytes = new Uint8Array(exifBuf);
        const hasExifPrefix =
          rawBytes.length >= 6 &&
          rawBytes[0] === 0x45 &&
          rawBytes[1] === 0x78 &&
          rawBytes[2] === 0x69 &&
          rawBytes[3] === 0x66 &&
          rawBytes[4] === 0x00 &&
          rawBytes[5] === 0x00;
        const tiffBytes = hasExifPrefix ? rawBytes.subarray(6) : rawBytes;

        // Wrap as JPEG APP1 segment (0xFFE1 + len + 'Exif\0\0' + TIFF)
        const app1Len = 2 + 6 + tiffBytes.length;
        const app1 = new Uint8Array(2 + app1Len);
        app1[0] = 0xff;
        app1[1] = 0xe1;
        app1[2] = (app1Len >> 8) & 0xff;
        app1[3] = app1Len & 0xff;
        app1[4] = 0x45;
        app1[5] = 0x78;
        app1[6] = 0x69;
        app1[7] = 0x66;
        app1[8] = 0x00;
        app1[9] = 0x00;
        app1.set(tiffBytes, 10);
        normalizeExifOrientation(app1);
        segments.push(app1);
      }

      // 'ICCP' (0x49434350)
      if (fourCC === 0x49434350 && chunkDataSize > 0) {
        const iccBuf = await fileOrBlob
          .slice(offset + 8, offset + 8 + chunkDataSize)
          .arrayBuffer();
        const iccBytes = new Uint8Array(iccBuf);

        // Wrap as JPEG APP2 segment (0xFFE2 + len + 'ICC_PROFILE\0' + 0x01 + 0x01 + ICC)
        const app2Len = 2 + 14 + iccBytes.length;
        const app2 = new Uint8Array(2 + app2Len);
        app2[0] = 0xff;
        app2[1] = 0xe2;
        app2[2] = (app2Len >> 8) & 0xff;
        app2[3] = app2Len & 0xff;
        const iccHeader = [
          0x49, 0x43, 0x43, 0x5f, 0x50, 0x52, 0x4f, 0x46, 0x49, 0x4c, 0x45, 0x00, 0x01, 0x01,
        ];
        app2.set(iccHeader, 4);
        app2.set(iccBytes, 18);
        segments.push(app2);
      }

      offset += 8 + paddedSize;
    }

    return segments;
  }

  return [];
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
  if (headView.byteLength < 4 || headView.getUint16(0) !== 0xffd8) {
    return compressedBlob;
  }

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
 * Inspects raw JPEG or WebP markers/chunks to extract camera info, orientation, and Display P3 ICC profile.
 */
export async function getImageMetadata(fileOrBlob: Blob): Promise<ImageMetadata> {
  const result: ImageMetadata = {
    hasExif: false,
    hasIccProfile: false,
    colorSpace: "sRGB (Standard)",
  };

  const chunkSize = Math.min(fileOrBlob.size, 256 * 1024);
  const buffer = await fileOrBlob.slice(0, chunkSize).arrayBuffer();
  const view = new DataView(buffer);
  if (view.byteLength < 12) return result;

  // Case 1: JPEG (SOI 0xFFD8)
  if (view.getUint16(0) === 0xffd8) {
    let offset = 2;
    while (offset + 4 < view.byteLength) {
      const marker = view.getUint16(offset);
      if (marker === 0xffda || marker === 0xffd9 || (marker & 0xff00) !== 0xff00) {
        break;
      }

      const segLength = view.getUint16(offset + 2);
      if (segLength < 2 || offset + 2 + segLength > view.byteLength) break;

      // APP2: ICC Profile
      if (marker === 0xffe2) {
        result.hasIccProfile = true;
        if (segLength >= 14) {
          result.colorSpace = "Display P3 / Wide Gamut (APP2 Preserved)";
        }
      }

      // APP1: EXIF
      if (marker === 0xffe1 && segLength >= 14) {
        const isExif =
          view.getUint8(offset + 4) === 0x45 &&
          view.getUint8(offset + 5) === 0x78 &&
          view.getUint8(offset + 6) === 0x69 &&
          view.getUint8(offset + 7) === 0x66;

        if (isExif) {
          result.hasExif = true;
          parseExifTiff(view, offset + 10, result);
        }
      }

      offset += 2 + segLength;
    }
    return result;
  }

  // Case 2: WebP ('RIFF'....'WEBP')
  if (
    view.byteLength >= 12 &&
    view.getUint32(0, false) === 0x52494646 &&
    view.getUint32(8, false) === 0x57454250
  ) {
    let offset = 12;
    const fileSize = fileOrBlob.size;

    while (offset + 8 <= fileSize) {
      let fourCC: number;
      let chunkDataSize: number;

      if (offset + 8 <= view.byteLength) {
        fourCC = view.getUint32(offset, false);
        chunkDataSize = view.getUint32(offset + 4, true);
      } else {
        const headerBuf = await fileOrBlob.slice(offset, offset + 8).arrayBuffer();
        if (headerBuf.byteLength < 8) break;
        const headerView = new DataView(headerBuf);
        fourCC = headerView.getUint32(0, false);
        chunkDataSize = headerView.getUint32(4, true);
      }

      const paddedSize = (chunkDataSize + 1) & ~1;

      // 'ICCP' (0x49434350)
      if (fourCC === 0x49434350) {
        result.hasIccProfile = true;
        result.colorSpace = "Display P3 / Wide Gamut (ICCP Preserved)";
      }

      // 'EXIF' (0x45584946)
      if (fourCC === 0x45584946 && chunkDataSize >= 6) {
        result.hasExif = true;
        let exifView: DataView;
        if (offset + 8 + chunkDataSize <= view.byteLength) {
          exifView = new DataView(buffer, offset + 8, chunkDataSize);
        } else {
          const exifBuf = await fileOrBlob
            .slice(offset + 8, offset + 8 + chunkDataSize)
            .arrayBuffer();
          exifView = new DataView(exifBuf);
        }

        let tiffStart = 0;
        // If starts with 'Exif\0\0', skip 6 bytes
        if (
          exifView.byteLength >= 6 &&
          exifView.getUint8(0) === 0x45 &&
          exifView.getUint8(1) === 0x78 &&
          exifView.getUint8(2) === 0x69 &&
          exifView.getUint8(3) === 0x66 &&
          exifView.getUint8(4) === 0x00 &&
          exifView.getUint8(5) === 0x00
        ) {
          tiffStart = 6;
        }
        parseExifTiff(exifView, tiffStart, result);
      }

      offset += 8 + paddedSize;
    }
    return result;
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

    if (tagId === 0x0112) {
      out.orientation = view.getUint16(entryOffset + 8, isLittleEndian);
    } else if (tagId === 0x010f && type === 2) {
      out.make = readAscii(view, tiffStart, entryOffset, count, isLittleEndian);
    } else if (tagId === 0x0110 && type === 2) {
      out.model = readAscii(view, tiffStart, entryOffset, count, isLittleEndian);
    } else if (tagId === 0x0132 && type === 2) {
      out.dateTime = readAscii(view, tiffStart, entryOffset, count, isLittleEndian);
    } else if (tagId === 0x8769 && (type === 3 || type === 4)) {
      // Exif IFD Pointer
      exifSubIfdOffset = view.getUint32(entryOffset + 8, isLittleEndian);
    }
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

        if ((tagId === 0x9003 || tagId === 0x9004) && type === 2 && !out.dateTime) {
          out.dateTime = readAscii(view, tiffStart, entryOffset, count, isLittleEndian);
        }
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
