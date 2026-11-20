import { describe, expect, test } from "bun:test";
import {
  extractMetadataSegments,
  normalizeExifOrientation,
  spliceMetadataIntoBlob,
} from "../src/jpeg";
describe("imgcompressor - JPEG metadata engine", () => {
  test("normalizeExifOrientation resets Orientation tag to 1 in Little-Endian (II) EXIF", () => {
    // Construct synthetic APP1 segment with Little-Endian EXIF header
    const buffer = new Uint8Array(40);
    // Marker 0xFFE1 + length 38
    buffer[0] = 0xff;
    buffer[1] = 0xe1;
    buffer[2] = 0x00;
    buffer[3] = 38;
    // 'Exif\0\0'
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
    buffer[28] = 0x06; // Orientation = 6
    buffer[29] = 0x00;

    const modified = normalizeExifOrientation(buffer);
    expect(modified).toBe(true);
    // Value must now be 1
    expect(buffer[28]).toBe(0x01);
    expect(buffer[29]).toBe(0x00);
  });

  test("normalizeExifOrientation resets Orientation tag to 1 in Big-Endian (MM) EXIF", () => {
    // Construct synthetic APP1 segment with Big-Endian EXIF header
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
    // TIFF header: 'MM' (0x4D4D), 42 (0x002A), offset to IFD0 = 8
    buffer[10] = 0x4d;
    buffer[11] = 0x4d;
    buffer[12] = 0x00;
    buffer[13] = 0x2a;
    buffer[14] = 0x00;
    buffer[15] = 0x00;
    buffer[16] = 0x00;
    buffer[17] = 0x08;
    // IFD0 at 10 + 8 = 18. Tag count = 1
    buffer[18] = 0x00;
    buffer[19] = 0x01;
    // Entry 1 at offset 20: Tag 0x0112 (Orientation), Type 3 (SHORT), Count 1, Value = 8 (Rotated 270 CW)
    buffer[20] = 0x01;
    buffer[21] = 0x12;
    buffer[22] = 0x00;
    buffer[23] = 0x03;
    buffer[24] = 0x00;
    buffer[25] = 0x00;
    buffer[26] = 0x00;
    buffer[27] = 0x01;
    buffer[28] = 0x00;
    buffer[29] = 0x08; // Orientation = 8

    const modified = normalizeExifOrientation(buffer);
    expect(modified).toBe(true);
    // Value must now be 1
    expect(buffer[28]).toBe(0x00);
    expect(buffer[29]).toBe(0x01);
  });

  test("extractMetadataSegments ignores non-JPEG files", async () => {
    const pngBlob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], {
      type: "image/png",
    });
    const segments = await extractMetadataSegments(pngBlob);
    expect(segments).toEqual([]);
  });

  test("spliceMetadataIntoBlob correctly injects segments after SOI", async () => {
    // SOI (0xFFD8) + body bytes
    const dummyJpeg = new Blob(
      [new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43])],
      {
        type: "image/jpeg",
      },
    );
    const testSegment = new Uint8Array([0xff, 0xe1, 0x00, 0x06, 0xaa, 0xbb]);

    const spliced = await spliceMetadataIntoBlob(dummyJpeg, [testSegment]);
    const bytes = new Uint8Array(await spliced.arrayBuffer());

    // Bytes must be: SOI (2) + segment (6) + body (4) = 12 bytes
    expect(bytes.length).toBe(12);
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);
    expect(bytes[2]).toBe(0xff);
    expect(bytes[3]).toBe(0xe1);
    expect(bytes[4]).toBe(0x00);
    expect(bytes[5]).toBe(0x06);
    expect(bytes[6]).toBe(0xaa);
    expect(bytes[7]).toBe(0xbb);
    expect(bytes[8]).toBe(0xff);
    expect(bytes[9]).toBe(0xdb);
  });
});
