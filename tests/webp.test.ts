import { describe, expect, test } from "bun:test";
import {
  insertWebPExif,
  normalizeExif,
  parseChunks,
  serializeChunks,
} from "../src/webp";
import { getImageMetadata } from "../src/jpeg";

// Helper to build a minimal valid simple lossy VP8 WebP
function createSimpleVp8Webp(width: number, height: number): Uint8Array {
  // VP8 chunk data (10 bytes min header)
  const vp8Payload = new Uint8Array(10);
  vp8Payload[0] = 0x00; vp8Payload[1] = 0x00; vp8Payload[2] = 0x00; // frame tag
  vp8Payload[3] = 0x9d; vp8Payload[4] = 0x01; vp8Payload[5] = 0x2a; // start code
  vp8Payload[6] = width & 0xff;
  vp8Payload[7] = (width >> 8) & 0x3f;
  vp8Payload[8] = height & 0xff;
  vp8Payload[9] = (height >> 8) & 0x3f;

  return serializeChunks([{ fourCC: "VP8 ", data: vp8Payload }]);
}

// Helper to build a synthetic TIFF Exif payload (Orientation = 1, Make = "TestCam")
function createSyntheticExif(orientation = 1, withApp1Prefix = true): Uint8Array {
  // TIFF: II (2), 42 (2), offset 8 (4), tag count 1 (2), tag 0x0112 (12) = 22 bytes
  const tiff = new Uint8Array(22);
  tiff[0] = 0x49; tiff[1] = 0x49; // 'II'
  tiff[2] = 0x2a; tiff[3] = 0x00; // 42
  tiff[4] = 0x08; tiff[5] = 0x00; tiff[6] = 0x00; tiff[7] = 0x00; // IFD0 offset = 8
  tiff[8] = 0x01; tiff[9] = 0x00; // tag count = 1
  // Tag 0x0112: Orientation, SHORT (3), Count 1, Value
  tiff[10] = 0x12; tiff[11] = 0x01;
  tiff[12] = 0x03; tiff[13] = 0x00;
  tiff[14] = 0x01; tiff[15] = 0x00; tiff[16] = 0x00; tiff[17] = 0x00;
  tiff[18] = orientation & 0xff; tiff[19] = 0x00;

  if (!withApp1Prefix) {
    return tiff;
  }

  // Prepend JPEG APP1 prefix: 0xFFE1 + len + 'Exif\0\0' (10 bytes)
  const full = new Uint8Array(10 + tiff.length);
  full[0] = 0xff; full[1] = 0xe1;
  full[2] = 0x00; full[3] = tiff.length + 8;
  full[4] = 0x45; full[5] = 0x78; full[6] = 0x69; full[7] = 0x66;
  full[8] = 0x00; full[9] = 0x00;
  full.set(tiff, 10);
  return full;
}

describe("WebP EXIF Muxer", () => {
  test("normalizeExif strips APP1 prefix and verifies TIFF header", () => {
    const raw = createSyntheticExif(1, true);
    const normalized = normalizeExif(raw);

    // Must start with 'II'
    expect(normalized[0]).toBe(0x49);
    expect(normalized[1]).toBe(0x49);
    expect(normalized[2]).toBe(0x2a);
    expect(normalized[3]).toBe(0x00);
  });

  test("insertWebPExif upgrades simple VP8 WebP to Extended VP8X with EXIF", async () => {
    const webp = createSimpleVp8Webp(1920, 1080);
    const rawExif = createSyntheticExif(1, true);

    const result = insertWebPExif(webp, rawExif);
    const chunks = parseChunks(result);

    // Chunks must be: VP8X, VP8 , EXIF
    expect(chunks.length).toBe(3);
    expect(chunks[0].fourCC).toBe("VP8X");
    expect(chunks[1].fourCC).toBe("VP8 ");
    expect(chunks[2].fourCC).toBe("EXIF");

    // VP8X flag for EXIF (0x08)
    expect((chunks[0].data[0] & 0x08)).toBe(0x08);

    // Roundtrip inspection with getImageMetadata
    const blob = new Blob([result.buffer as ArrayBuffer], { type: "image/webp" });
    const meta = await getImageMetadata(blob);
    expect(meta.hasExif).toBe(true);
    expect(meta.orientation).toBe(1);
  });

  test("insertWebPExif handles odd-length EXIF payloads with RIFF padding", () => {
    const webp = createSimpleVp8Webp(800, 600);
    // Create odd-length TIFF (23 bytes instead of 22)
    const oddTiff = new Uint8Array(23);
    oddTiff.set(createSyntheticExif(1, false));

    const result = insertWebPExif(webp, oddTiff);
    const chunks = parseChunks(result);

    const exifChunk = chunks.find((c) => c.fourCC === "EXIF");
    expect(exifChunk).toBeDefined();
    expect(exifChunk?.data.length).toBe(23);

    // Serialized output must be even in byte alignment
    expect(result.length % 2).toBe(0);
  });

  test("insertWebPExif replaces existing EXIF chunk rather than duplicating", () => {
    const webp = createSimpleVp8Webp(640, 480);
    const exif1 = createSyntheticExif(1, true);
    const exif2 = createSyntheticExif(1, false);

    const step1 = insertWebPExif(webp, exif1);
    const step2 = insertWebPExif(step1, exif2);

    const chunks = parseChunks(step2);
    const exifChunks = chunks.filter((c) => c.fourCC === "EXIF");
    expect(exifChunks.length).toBe(1);
  });

  test("throws error on invalid WebP or empty EXIF", () => {
    const invalidWebp = new Uint8Array([0x00, 0x01, 0x02]);
    expect(() => insertWebPExif(invalidWebp, createSyntheticExif(1, false))).toThrow();
  });

  test("compressImage short-circuits on WebP 100% quality without size ceiling to prevent expansion", async () => {
    const { compressImage } = await import("../src/index");
    const dummyBlob = new Blob([new Uint8Array(1000)], { type: "image/jpeg" });

    // Should immediately return the same blob when quality is 1 and mimeType is webp without maxSizeMB
    const result = await compressImage(dummyBlob, {
      quality: 1,
      mimeType: "image/webp",
    });

    expect(result).toBe(dummyBlob);
  });

  test("compressImage detects WebP input and preserves it without expansion", async () => {
    const { compressImage } = await import("../src/index");
    const dummyWebpBlob = new Blob([new Uint8Array(2000)], { type: "image/webp" });

    // When quality is 1.0 on a WebP file, it short-circuits and preserves original blob
    const result = await compressImage(dummyWebpBlob, {
      quality: 1,
    });

    expect(result).toBe(dummyWebpBlob);
  });

  test("getImageMetadata and extractMetadataSegments parse EXIF beyond 256KB WebP pixel frame", async () => {
    const { extractMetadataSegments } = await import("../src/jpeg");

    // Create a WebP with a 300KB VP8 payload (>256KB default read buffer) followed by EXIF
    const largeVp8Payload = new Uint8Array(300 * 1024);
    largeVp8Payload[3] = 0x9d; largeVp8Payload[4] = 0x01; largeVp8Payload[5] = 0x2a;
    largeVp8Payload[6] = 1920 & 0xff; largeVp8Payload[7] = (1920 >> 8) & 0x3f;
    largeVp8Payload[8] = 1080 & 0xff; largeVp8Payload[9] = (1080 >> 8) & 0x3f;

    const baseWebp = serializeChunks([{ fourCC: "VP8 ", data: largeVp8Payload }]);
    const rawExif = createSyntheticExif(1, true);

    const fullWebp = insertWebPExif(baseWebp, rawExif);
    expect(fullWebp.length).toBeGreaterThan(300 * 1024);

    const blob = new Blob([fullWebp.buffer as ArrayBuffer], { type: "image/webp" });

    // 1. getImageMetadata should find and parse EXIF chunk past the 300KB frame
    const meta = await getImageMetadata(blob);
    expect(meta.hasExif).toBe(true);
    expect(meta.orientation).toBe(1);

    // 2. extractMetadataSegments should extract the EXIF as APP1 segment from WebP
    const segments = await extractMetadataSegments(blob);
    expect(segments.length).toBe(1);
    expect(segments[0][0]).toBe(0xff);
    expect(segments[0][1]).toBe(0xe1); // APP1
  });
});
