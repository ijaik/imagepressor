/**
 * Extracts raw EXIF (APP1, 0xFFE1) and ICC Profile (APP2, 0xFFE2) metadata segments from a JPEG file.
 * Reads only the first 256 KB of the file, keeping memory usage minimal.
 */
export async function extractMetadataSegments(
  fileOrBlob: Blob,
): Promise<Uint8Array[]> {
  const chunkSize = Math.min(fileOrBlob.size, 256 * 1024);
  const buffer = await fileOrBlob.slice(0, chunkSize).arrayBuffer();
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return [];

  const segments: Uint8Array[] = [];
  let offset = 2;

  while (offset + 4 < view.byteLength) {
    const marker = view.getUint16(offset);
    // Stop at Start of Scan (SOS), End of Image (EOI), or invalid marker
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

/**
 * Normalizes the EXIF Orientation tag to 1 (normal / top-left) in place.
 * Since modern browsers decode and draw upright on canvas (or via createImageBitmap),
 * resetting orientation to 1 prevents external photo viewers from rotating a second time.
 */
export function normalizeExifOrientation(segment: Uint8Array): boolean {
  if (segment.length < 14) return false;

  // Check for APP1 marker (0xFFE1) + length + 'Exif\0\0'
  const isExif =
    segment[0] === 0xff &&
    segment[1] === 0xe1 &&
    segment[4] === 0x45 && // 'E'
    segment[5] === 0x78 && // 'x'
    segment[6] === 0x69 && // 'i'
    segment[7] === 0x66 && // 'f'
    segment[8] === 0x00 &&
    segment[9] === 0x00;

  if (!isExif) return false;

  const tiffStart = 10;
  const view = new DataView(
    segment.buffer,
    segment.byteOffset,
    segment.byteLength,
  );

  const isLittleEndian = view.getUint16(tiffStart) === 0x4949; // 'II'
  if (!isLittleEndian && view.getUint16(tiffStart) !== 0x4d4d) return false; // 'MM'
  if (view.getUint16(tiffStart + 2, isLittleEndian) !== 0x002a) return false; // 42

  const firstIfdOffset = view.getUint32(tiffStart + 4, isLittleEndian);
  const ifdStart = tiffStart + firstIfdOffset;
  if (ifdStart + 2 > segment.length) return false;

  const tagCount = view.getUint16(ifdStart, isLittleEndian);
  for (let i = 0; i < tagCount; i++) {
    const entryOffset = ifdStart + 2 + i * 12;
    if (entryOffset + 12 > segment.length) break;

    const tagId = view.getUint16(entryOffset, isLittleEndian);
    if (tagId === 0x0112) {
      // Orientation tag: write 1 (SHORT = 3, count = 1)
      view.setUint16(entryOffset + 8, 1, isLittleEndian);
      return true;
    }
  }

  return false;
}

/**
 * Injects raw original metadata segments into the canvas-compressed JPEG blob.
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

  let startOffset = 2; // Right after SOI (0xFFD8)
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
