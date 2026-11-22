import { describe, expect, test } from "bun:test";
import {
  extractMetadataSegments,
  getImageMetadata,
  normalizeExifOrientation,
  spliceMetadataIntoBlob,
} from "../src/jpeg";
import { spliceWebpMetadata } from "../src/webp";

describe("imagepressor - JPEG & WebP metadata engine", () => {
  test("normalizeExifOrientation resets Orientation tag to 1 in Little-Endian (II) EXIF", () => {
    // Construct synthetic APP1 segment with Little-Endian EXIF header
    const buffer = new Uint8Array(40);
    buffer[0] = 0xff;
    buffer[1] = 0xe1;
    buffer[2] = 0x00;
    buffer[3] = 38;
    buffer[4] = 0x45;
    buffer[5] = 0x78;
    buffer[6] = 0x69;
    buffer[7] = 0x66;
    buffer[8] = 0x00;
    buffer[9] = 0x00;
    // TIFF header: 'II' (0x4949), 42 (0x002A), offset to IFD0 = 8
    buffer[10] = 0x49;
    buffer[11] = 0x49;
    buffer[12] = 0x2a;
    buffer[13] = 0x00;
    buffer[14] = 0x08;
    buffer[15] = 0x00;
    buffer[16] = 0x00;
    buffer[17] = 0x00;
    // IFD0 at 10 + 8 = 18. Tag count = 1
    buffer[18] = 0x01;
    buffer[19] = 0x00;
    // Entry 1 at offset 20: Tag 0x0112 (Orientation), Type 3 (SHORT), Count 1, Value = 6 (Rotated 90 CW)
    buffer[20] = 0x12;
    buffer[21] = 0x01;
    buffer[22] = 0x03;
    buffer[23] = 0x00;
    buffer[24] = 0x01;
    buffer[25] = 0x00;
    buffer[26] = 0x00;
    buffer[27] = 0x00;
    buffer[28] = 0x06;
    buffer[29] = 0x00;

    const modified = normalizeExifOrientation(buffer);
    expect(modified).toBe(true);
    expect(buffer[28]).toBe(0x01);
    expect(buffer[29]).toBe(0x00);
  });

  test("getImageMetadata detects EXIF and orientation from JPEG", async () => {
    const segment = new Uint8Array(42);
    segment[0] = 0xff;
    segment[1] = 0xd8; // SOI
    segment[2] = 0xff;
    segment[3] = 0xe1; // APP1
    segment[4] = 0x00;
    segment[5] = 38;
    segment[6] = 0x45;
    segment[7] = 0x78;
    segment[8] = 0x69;
    segment[9] = 0x66;
    segment[10] = 0x00;
    segment[11] = 0x00;
    segment[12] = 0x49;
    segment[13] = 0x49;
    segment[14] = 0x2a;
    segment[15] = 0x00;
    segment[16] = 0x08;
    segment[17] = 0x00;
    segment[18] = 0x00;
    segment[19] = 0x00;
    segment[20] = 0x01;
    segment[21] = 0x00;
    segment[22] = 0x12;
    segment[23] = 0x01;
    segment[24] = 0x03;
    segment[25] = 0x00;
    segment[26] = 0x01;
    segment[27] = 0x00;
    segment[28] = 0x00;
    segment[29] = 0x00;
    segment[30] = 0x03;
    segment[31] = 0x00;

    const blob = new Blob([segment], { type: "image/jpeg" });
    const meta = await getImageMetadata(blob);
    expect(meta.hasExif).toBe(true);
    expect(meta.orientation).toBe(3);
  });

  test("spliceWebpMetadata injects EXIF chunk into WebP and getImageMetadata reads it", async () => {
    // Synthetic simple WebP: RIFF (4) + size (4) + WEBP (4) + VP8  (4) + size (4) + payload (4) = 24 bytes
    const simpleWebpBytes = new Uint8Array(24);
    simpleWebpBytes.set([0x52, 0x49, 0x46, 0x46]); // 'RIFF'
    new DataView(simpleWebpBytes.buffer).setUint32(4, 16, true); // size = 16
    simpleWebpBytes.set([0x57, 0x45, 0x42, 0x50], 8); // 'WEBP'
    simpleWebpBytes.set([0x56, 0x50, 0x38, 0x20], 12); // 'VP8 '
    new DataView(simpleWebpBytes.buffer).setUint32(16, 4, true); // chunk size = 4
    simpleWebpBytes.set([0x01, 0x02, 0x03, 0x04], 20); // payload

    const webpBlob = new Blob([simpleWebpBytes], { type: "image/webp" });

    // Synthetic APP1 segment
    const app1 = new Uint8Array(40);
    app1[0] = 0xff;
    app1[1] = 0xe1;
    app1[2] = 0x00;
    app1[3] = 38;
    app1[4] = 0x45;
    app1[5] = 0x78;
    app1[6] = 0x69;
    app1[7] = 0x66;
    app1[8] = 0x00;
    app1[9] = 0x00;
    app1[10] = 0x49;
    app1[11] = 0x49;
    app1[12] = 0x2a;
    app1[13] = 0x00;
    app1[14] = 0x08;
    app1[15] = 0x00;
    app1[16] = 0x00;
    app1[17] = 0x00;
    app1[18] = 0x01;
    app1[19] = 0x00;
    app1[20] = 0x12;
    app1[21] = 0x01;
    app1[22] = 0x03;
    app1[23] = 0x00;
    app1[24] = 0x01;
    app1[25] = 0x00;
    app1[26] = 0x00;
    app1[27] = 0x00;
    app1[28] = 0x01; // Orientation = 1
    app1[29] = 0x00;

    const splicedWebp = await spliceWebpMetadata(webpBlob, [app1], 800, 600);
    expect(splicedWebp.type).toBe("image/webp");

    const meta = await getImageMetadata(splicedWebp);
    expect(meta.hasExif).toBe(true);
    expect(meta.orientation).toBe(1);
  });

  test("compressImage short-circuits on JPEG 100% quality without size ceiling to prevent re-compression", async () => {
    const { compressImage } = await import("../src/index");
    const dummyBlob = new Blob([new Uint8Array(1000)], { type: "image/jpeg" });

    const result = await compressImage(dummyBlob, {
      quality: 1,
      mimeType: "image/jpeg",
    });

    expect(result).toBe(dummyBlob);
  });
});
