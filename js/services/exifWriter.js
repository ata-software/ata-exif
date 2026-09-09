import { detectFormat } from './exifReader.js';

/* global piexif */

/**
 * EXIF standard requires printable ASCII (bytes 0x20-0x7E) for Ascii tags.
 * Replaces non-ASCII symbols like Greek alpha (α) with ASCII equivalents (Alpha)
 * and transliterates Turkish characters to prevent data loss.
 */
export function toExifAscii(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    // Transliterate Greek Alpha with space preservation
    .replace(/α(\d)/gi, 'Alpha $1')
    .replace(/α/gi, 'Alpha ')
    .replace(/Α(\d)/gi, 'Alpha $1')
    .replace(/Α/gi, 'Alpha ')
    // Transliterate Turkish characters
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u').replace(/Ü/g, 'U')
    .replace(/ş/g, 's').replace(/Ş/g, 'S')
    .replace(/ı/g, 'i').replace(/İ/g, 'I')
    .replace(/ö/g, 'o').replace(/Ö/g, 'O')
    .replace(/ç/g, 'c').replace(/Ç/g, 'C')
    // Remove non-printable ASCII
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convert a float focal length to an EXIF rational [numerator, denominator]
 * e.g., 24 -> [240, 10], 24.5 -> [245, 10], 50 -> [500, 10]
 */
function toRational(val) {
  const num = parseFloat(val);
  if (isNaN(num) || num <= 0) return [240, 10];
  const denominator = 10;
  const numerator = Math.round(num * denominator);
  return [numerator, denominator];
}

/**
 * Helper: Convert ArrayBuffer to binary string
 */
function arrayBufferToBinaryString(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const chunk = 8192;
  for (let i = 0; i < len; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunk, len)));
  }
  return binary;
}

/**
 * Helper: Convert binary string to Uint8Array
 */
function binaryStringToUint8Array(str) {
  const len = str.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = str.charCodeAt(i);
  }
  return bytes;
}

/**
 * Helper: Format current timestamp to EXIF standard format (YYYY:MM:DD HH:MM:SS)
 */
function getExifDateString(dateObj = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const year = dateObj.getFullYear();
  const month = pad(dateObj.getMonth() + 1);
  const day = pad(dateObj.getDate());
  const hours = pad(dateObj.getHours());
  const minutes = pad(dateObj.getMinutes());
  const seconds = pad(dateObj.getSeconds());
  return `${year}:${month}:${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Build standard Adobe/Microsoft XMP packet for maximum OS compatibility (Windows Explorer, iOS Photos, Android)
 */
export function buildXmpPacket(metadata, dateStr, exposureTimeStr, fNumberStr, isoStr) {
  let make = toExifAscii(metadata.make) || '';
  let model = toExifAscii(metadata.model) || '';
  if (!make && model) {
    if (/sony|ilce|alpha 1/i.test(model)) make = 'Sony';
    else if (/iphone|apple/i.test(model)) make = 'Apple';
    else if (/canon/i.test(model)) make = 'Canon';
    else if (/nikon/i.test(model)) make = 'Nikon';
    else if (/fuji/i.test(model)) make = 'Fujifilm';
    else make = 'Sony';
  }
  if (!make) make = 'Sony';
  if (!model) model = 'Sony Alpha 1 II';

  // Format model for maximum phone gallery recognition
  let xmpModel = model;
  if (/sony/i.test(make) && (/alpha 1 ii|a1 ii/i.test(model))) {
    xmpModel = 'ILCE-1M2';
  }

  const lensModel = toExifAscii(metadata.lensModel) || '';
  const lensMake = toExifAscii(metadata.lensMake || metadata.make) || make;
  const focalLength = parseFloat(metadata.focalLength) || 50;

  // ISO 8601 date: YYYY-MM-DDTHH:MM:SS
  const isoDate = dateStr
    ? dateStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3').replace(' ', 'T')
    : new Date().toISOString().slice(0, 19);

  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="XMP Core 5.5.0">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:tiff="http://ns.adobe.com/tiff/1.0/"
    xmlns:exif="http://ns.adobe.com/exif/1.0/"
    xmlns:exifEX="http://cipa.jp/exif/1.0/"
    xmlns:aux="http://ns.adobe.com/exif/1.0/aux/"
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
    xmlns:MicrosoftPhoto="http://ns.microsoft.com/photo/1.0/">
   <tiff:Make>${make}</tiff:Make>
   <tiff:Model>${xmpModel}</tiff:Model>
   <exif:Make>${make}</exif:Make>
   <exif:Model>${xmpModel}</exif:Model>
   <exifEX:CameraModel>${xmpModel}</exifEX:CameraModel>
   ${lensModel ? `<aux:Lens>${lensModel}</aux:Lens>` : ''}
   ${lensModel ? `<exifEX:LensModel>${lensModel}</exifEX:LensModel>` : ''}
   ${lensMake ? `<exifEX:LensMake>${lensMake}</exifEX:LensMake>` : ''}
   ${lensModel ? `<MicrosoftPhoto:LensModel>${lensModel}</MicrosoftPhoto:LensModel>` : ''}
   ${lensMake ? `<MicrosoftPhoto:LensManufacturer>${lensMake}</MicrosoftPhoto:LensManufacturer>` : ''}
   <MicrosoftPhoto:CameraManufacturer>${make}</MicrosoftPhoto:CameraManufacturer>
   <MicrosoftPhoto:CameraModel>${xmpModel}</MicrosoftPhoto:CameraModel>
   <exif:FocalLength>${focalLength}/1</exif:FocalLength>
   <exif:FocalLengthIn35mmFilm>${Math.round(focalLength)}</exif:FocalLengthIn35mmFilm>
   ${fNumberStr ? `<exif:FNumber>${fNumberStr}</exif:FNumber>` : ''}
   ${exposureTimeStr ? `<exif:ExposureTime>${exposureTimeStr}</exif:ExposureTime>` : ''}
   ${isoStr ? `<exif:ISOSpeedRatings><rdf:Seq><rdf:li>${isoStr}</rdf:li></rdf:Seq></exif:ISOSpeedRatings>` : ''}
   <xmp:CreateDate>${isoDate}</xmp:CreateDate>
   <xmp:ModifyDate>${isoDate}</xmp:ModifyDate>
   <photoshop:DateCreated>${isoDate}</photoshop:DateCreated>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

/**
 * Wrap XMP XML in a valid JPEG APP1 segment
 */
export function createXmpSegment(xmpXml) {
  const encoder = new TextEncoder();
  const xmlBytes = encoder.encode(xmpXml);

  // XMP namespace identifier: "http://ns.adobe.com/xap/1.0/\0" (29 bytes)
  const headerStr = "http://ns.adobe.com/xap/1.0/\0";
  const headerBytes = new Uint8Array(29);
  for (let i = 0; i < 28; i++) {
    headerBytes[i] = headerStr.charCodeAt(i);
  }
  headerBytes[28] = 0;

  const payloadLen = 29 + xmlBytes.length;
  const segmentLen = 2 + payloadLen;

  const segment = new Uint8Array(2 + segmentLen);
  segment[0] = 0xFF;
  segment[1] = 0xE1;
  segment[2] = (segmentLen >> 8) & 0xFF;
  segment[3] = segmentLen & 0xFF;
  segment.set(headerBytes, 4);
  segment.set(xmlBytes, 4 + 29);

  return segment;
}

/**
 * Inject XMP APP1 segment into JPEG, removing old XMP and redundant canvas JFIF APP0
 */
export function injectXmpIntoJpeg(jpegUint8Array, xmpSegment) {
  if (jpegUint8Array[0] !== 0xFF || jpegUint8Array[1] !== 0xD8) {
    return jpegUint8Array;
  }

  const parts = [];
  parts.push(jpegUint8Array.subarray(0, 2)); // SOI

  let pos = 2;
  const len = jpegUint8Array.length;
  let xmpInserted = false;

  while (pos < len) {
    if (jpegUint8Array[pos] !== 0xFF) {
      parts.push(jpegUint8Array.subarray(pos));
      break;
    }

    const marker = jpegUint8Array[pos + 1];

    if (marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7)) {
      parts.push(jpegUint8Array.subarray(pos, pos + 2));
      pos += 2;
      continue;
    }

    // SOS (Start of Scan) - image pixel stream starts here
    if (marker === 0xDA) {
      if (!xmpInserted) {
        parts.push(xmpSegment);
        xmpInserted = true;
      }
      parts.push(jpegUint8Array.subarray(pos));
      break;
    }

    const segLen = (jpegUint8Array[pos + 2] << 8) | jpegUint8Array[pos + 3];
    const segEnd = pos + 2 + segLen;

    if (marker === 0xE1) {
      const isExif = (
        jpegUint8Array[pos + 4] === 0x45 && // 'E'
        jpegUint8Array[pos + 5] === 0x78 && // 'x'
        jpegUint8Array[pos + 6] === 0x69 && // 'i'
        jpegUint8Array[pos + 7] === 0x66 && // 'f'
        jpegUint8Array[pos + 8] === 0x00 &&
        jpegUint8Array[pos + 9] === 0x00
      );

      const isXmp = (
        jpegUint8Array[pos + 4] === 0x68 && // 'h'
        jpegUint8Array[pos + 5] === 0x74 && // 't'
        jpegUint8Array[pos + 6] === 0x74 && // 't'
        jpegUint8Array[pos + 7] === 0x70    // 'p'
      );

      if (isExif) {
        // Keep EXIF APP1, then immediately insert synchronized XMP APP1
        parts.push(jpegUint8Array.subarray(pos, segEnd));
        parts.push(xmpSegment);
        xmpInserted = true;
      } else if (isXmp) {
        // Discard old XMP
      } else {
        parts.push(jpegUint8Array.subarray(pos, segEnd));
      }
    } else if (marker === 0xE0) {
      // Discard JFIF APP0 to let EXIF/XMP be the sole authoritative photo descriptor
    } else {
      parts.push(jpegUint8Array.subarray(pos, segEnd));
    }

    pos = segEnd;
  }

  if (!xmpInserted) {
    parts.splice(1, 0, xmpSegment);
  }

  let totalLen = 0;
  for (const p of parts) totalLen += p.length;
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const p of parts) {
    result.set(p, offset);
    offset += p.length;
  }
  return result;
}

/**
 * CRC32 calculation for PNG chunk creation
 */
const CRC_TABLE = (function() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer, offset, length) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[offset + i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

export class ExifWriter {
  /**
   * Apply edited metadata 100% losslessly to an image file.
   * Görüntü piksellerini ve çözünürlüğü ASLA yeniden boyutlandırmaz veya bozmaz.
   * Megapiksel ve çözünürlük değerleri salt EXIF meta veri etiketlerine yazılır.
   * 
   * @param {File|Blob} originalFile - The original image file
   * @param {Object} metadata - Edited metadata { make, model, lensModel, lensMake, focalLength, megapixels }
   * @param {Object} originalInfo - Info extracted by exifReader { width, height, mimeType, rawExif }
   * @returns {Promise<Blob>}
   */
  static async applyMetadata(originalFile, metadata, originalInfo) {
    if (originalInfo && originalInfo.isConvertedHeic && originalInfo.workingBuffer) {
      return this.modifyJpeg(originalInfo.workingBuffer, metadata, originalInfo);
    }

    const arrayBuffer = await originalFile.arrayBuffer();
    const detected = detectFormat(arrayBuffer) || (originalInfo && originalInfo.detectedMime) || originalFile.type || 'image/jpeg';

    if (detected === 'image/jpeg' || detected === 'image/jpg') {
      return this.modifyJpeg(arrayBuffer, metadata, originalInfo);
    } else if (detected === 'image/png') {
      return this.modifyPng(arrayBuffer, metadata, originalInfo);
    } else if (detected === 'image/webp') {
      return this.modifyWebP(arrayBuffer, metadata, originalInfo);
    } else if (detected === 'image/heic') {
      /* global heic2any */
      if (typeof heic2any !== 'undefined') {
        const conv = await heic2any({ blob: originalFile, toType: 'image/jpeg', quality: 0.98 });
        const convBlob = Array.isArray(conv) ? conv[0] : conv;
        const convBuf = await convBlob.arrayBuffer();
        return this.modifyJpeg(convBuf, metadata, originalInfo);
      }
      throw new Error('HEIC dosyası dönüştürülemedi.');
    } else {
      try {
        return this.modifyJpeg(arrayBuffer, metadata, originalInfo);
      } catch (_) {
        return this.modifyPng(arrayBuffer, metadata, originalInfo);
      }
    }
  }

  /**
   * Prepare a standard or updated EXIF object for piexif
   */
  static buildExifObject(metadata, originalInfo) {
    let exifObj = {
      '0th': {},
      'Exif': {},
      'GPS': {},
      'Interop': {},
      '1st': {},
      'thumbnail': null
    };

    // Try to load existing EXIF if available
    if (originalInfo && originalInfo.rawBinary) {
      try {
        const loaded = piexif.load(originalInfo.rawBinary);
        if (loaded && typeof loaded === 'object') {
          exifObj = loaded;
        }
      } catch (e) {
        console.warn('Existing EXIF could not be parsed by piexif; initializing fresh EXIF container', e);
      }
    }

    if (!exifObj['0th']) exifObj['0th'] = {};
    if (!exifObj['Exif']) exifObj['Exif'] = {};
    if (!exifObj['GPS']) exifObj['GPS'] = {};
    if (!exifObj['Interop']) exifObj['Interop'] = {};
    if (!exifObj['1st']) exifObj['1st'] = {};

    const dateStr = exifObj['Exif'][piexif.ExifIFD.DateTimeOriginal] || getExifDateString();

    // 1. Intelligently synchronize and resolve Camera Make and Model
    let inputMake = (metadata.make && String(metadata.make).trim()) || '';
    let inputModel = (metadata.model && String(metadata.model).trim()) || '';

    // Auto-detect Make from Model if Make is empty or mismatched with model
    if (/sony|ilce|alpha 1|α1|a1/i.test(inputModel)) {
      inputMake = 'Sony';
    } else if (/iphone|apple/i.test(inputModel)) {
      inputMake = 'Apple';
    } else if (/canon|eos/i.test(inputModel)) {
      inputMake = 'Canon';
    } else if (/nikon/i.test(inputModel) || /^z\s*\d/i.test(inputModel)) {
      inputMake = 'Nikon';
    } else if (/fuji/i.test(inputModel)) {
      inputMake = 'Fujifilm';
    } else if (/leica/i.test(inputModel)) {
      inputMake = 'Leica';
    } else if (/samsung|galaxy/i.test(inputModel)) {
      inputMake = 'Samsung';
    } else if (/google|pixel/i.test(inputModel)) {
      inputMake = 'Google';
    } else if (/xiaomi|redmi/i.test(inputModel)) {
      inputMake = 'Xiaomi';
    }

    if (!inputMake) {
      inputMake = exifObj['0th'][piexif.ImageIFD.Make] || 'Sony';
    }
    if (!inputModel) {
      inputModel = exifObj['0th'][piexif.ImageIFD.Model] || (/apple/i.test(inputMake) ? 'iPhone 16 Pro' : 'Sony Alpha 1 II');
    }

    let cleanMake = toExifAscii(inputMake);
    let cleanModel = toExifAscii(inputModel);

    // Official camera model normalization for phone gallery databases
    if (/sony/i.test(cleanMake) && (/alpha 1 ii|a1 ii|ilce-1/i.test(cleanModel))) {
      cleanModel = 'ILCE-1M2'; // Official Sony EXIF Model recognized by Apple Photos, Android & Windows
    }

    // 1. Camera Make (0th IFD Tag 271 / 0x010F)
    exifObj['0th'][piexif.ImageIFD.Make] = cleanMake;

    // 2. Camera Model (0th IFD Tag 272 / 0x0110)
    exifObj['0th'][piexif.ImageIFD.Model] = cleanModel;

    // 50708: UniqueCameraModel for mobile gallery recognition
    exifObj['0th'][50708] = toExifAscii(inputModel);

    // Authentic camera firmware based on Make (Apple Photos / Google Photos require clean camera firmware)
    let cameraFirmware = 'v1.00';
    if (/apple/i.test(cleanMake)) cameraFirmware = '18.2';
    else if (/sony/i.test(cleanMake)) cameraFirmware = 'ILCE-1M2 v1.00';
    else if (/canon/i.test(cleanMake)) cameraFirmware = 'Firmware Version 1.8.0';
    else if (/nikon/i.test(cleanMake)) cameraFirmware = 'Ver.1.00';

    // Essential standard 0th IFD tags for Windows Explorer and photo viewers
    exifObj['0th'][piexif.ImageIFD.Orientation] = exifObj['0th'][piexif.ImageIFD.Orientation] || 1;
    exifObj['0th'][piexif.ImageIFD.XResolution] = [72, 1];
    exifObj['0th'][piexif.ImageIFD.YResolution] = [72, 1];
    exifObj['0th'][piexif.ImageIFD.ResolutionUnit] = 2; // inches
    exifObj['0th'][piexif.ImageIFD.Software] = cameraFirmware;
    if (!exifObj['0th'][piexif.ImageIFD.DateTime]) {
      exifObj['0th'][piexif.ImageIFD.DateTime] = dateStr;
    }

    // 3. Lens Model (Exif IFD Tag 42036 / 0xA434)
    if (metadata.lensModel !== undefined && metadata.lensModel !== null && metadata.lensModel.trim().length > 0) {
      exifObj['Exif'][piexif.ExifIFD.LensModel] = toExifAscii(metadata.lensModel);
    } else if (!exifObj['Exif'][piexif.ExifIFD.LensModel]) {
      exifObj['Exif'][piexif.ExifIFD.LensModel] = 'Sony FE 50mm F1.2 GM';
    }

    // 4. Lens Make (Exif IFD Tag 42035 / 0xA433)
    if (metadata.lensMake !== undefined && metadata.lensMake !== null && metadata.lensMake.trim().length > 0) {
      exifObj['Exif'][piexif.ExifIFD.LensMake] = toExifAscii(metadata.lensMake);
    } else if (metadata.make && metadata.make.trim().length > 0) {
      exifObj['Exif'][piexif.ExifIFD.LensMake] = toExifAscii(metadata.make);
    } else if (!exifObj['Exif'][piexif.ExifIFD.LensMake]) {
      exifObj['Exif'][piexif.ExifIFD.LensMake] = exifObj['0th'][piexif.ImageIFD.Make] || 'Sony';
    }

    // 5. Focal Length (Exif IFD Tag 37386 / 0x920A)
    const flNum = (metadata.focalLength !== undefined && metadata.focalLength !== null && !isNaN(parseFloat(metadata.focalLength)))
      ? parseFloat(metadata.focalLength)
      : 50;
    exifObj['Exif'][piexif.ExifIFD.FocalLength] = toRational(flNum);
    exifObj['Exif'][piexif.ExifIFD.FocalLengthIn35mmFilm] = Math.round(flNum);

    // 6. Aperture / FNumber (Tag 33437 / 0x829D)
    // Intelligently parse aperture from lensModel (e.g., "f/1.2", "F1.2", "f/1.78")
    let fNum = 1.8;
    const lensStr = String(metadata.lensModel || exifObj['Exif'][piexif.ExifIFD.LensModel] || '');
    const fMatch = lensStr.match(/f\/?(\d+(\.\d+)?)/i);
    if (fMatch && fMatch[1]) {
      fNum = parseFloat(fMatch[1]);
    }
    if (!exifObj['Exif'][piexif.ExifIFD.FNumber]) {
      exifObj['Exif'][piexif.ExifIFD.FNumber] = [Math.round(fNum * 100), 100];
    }

    // 7. Exposure Time (Tag 33434 / 0x829A)
    if (!exifObj['Exif'][piexif.ExifIFD.ExposureTime]) {
      const isSony = /sony/i.test(metadata.make || '') || /sony/i.test(metadata.model || '');
      exifObj['Exif'][piexif.ExifIFD.ExposureTime] = isSony ? [1, 1250] : [1, 500];
    }

    // 8. ISO Speed Ratings (Tag 34855 / 0x8827)
    if (!exifObj['Exif'][piexif.ExifIFD.ISOSpeedRatings]) {
      const isApple = /apple/i.test(metadata.make || '') || /iphone/i.test(metadata.model || '');
      exifObj['Exif'][piexif.ExifIFD.ISOSpeedRatings] = isApple ? 50 : 100;
    }

    // 9. Lens Specification (Tag 42034 / 0xA432): [minFL, maxFL, minF, maxF]
    const flRat = [Math.round(flNum * 10), 10];
    const apRat = [Math.round(fNum * 100), 100];
    exifObj['Exif'][piexif.ExifIFD.LensSpecification] = [flRat, flRat, apRat, apRat];

    // 10. Date/Time Original & Digitized (Tags 36867 & 36868)
    if (!exifObj['Exif'][piexif.ExifIFD.DateTimeOriginal]) {
      exifObj['Exif'][piexif.ExifIFD.DateTimeOriginal] = dateStr;
    }
    if (!exifObj['Exif'][piexif.ExifIFD.DateTimeDigitized]) {
      exifObj['Exif'][piexif.ExifIFD.DateTimeDigitized] = dateStr;
    }

    // 11. Other photographic standards
    exifObj['Exif'][piexif.ExifIFD.ExifVersion] = '0232';
    exifObj['Exif'][piexif.ExifIFD.ColorSpace] = 1; // sRGB
    exifObj['Exif'][piexif.ExifIFD.ExposureProgram] = 2; // Normal program
    exifObj['Exif'][piexif.ExifIFD.MeteringMode] = 5; // Multi-segment / Pattern
    exifObj['Exif'][piexif.ExifIFD.ComponentsConfiguration] = '\x01\x02\x03\x00';

    // 12. Megapixels & Nominal Resolution Metadata
    if (metadata.megapixels !== undefined && metadata.megapixels !== null && !isNaN(parseFloat(metadata.megapixels))) {
      const mpVal = parseFloat(metadata.megapixels);
      const origW = (originalInfo && (originalInfo.rawPixelWidth || originalInfo.width)) || 4032;
      const origH = (originalInfo && (originalInfo.rawPixelHeight || originalInfo.height)) || 3024;
      const aspect = (origW > 0 && origH > 0) ? (origW / origH) : (4 / 3);
      
      const targetH = Math.max(1, Math.round(Math.sqrt((mpVal * 1000000) / aspect)));
      const targetW = Math.max(1, Math.round((mpVal * 1000000) / targetH));

      exifObj['0th'][piexif.ImageIFD.ImageWidth] = targetW;
      exifObj['0th'][piexif.ImageIFD.ImageLength] = targetH;
      exifObj['0th'][piexif.ImageIFD.ImageDescription] = toExifAscii(`Megapixels: ${mpVal}`);

      exifObj['Exif'][piexif.ExifIFD.PixelXDimension] = targetW;
      exifObj['Exif'][piexif.ExifIFD.PixelYDimension] = targetH;
      exifObj['Exif'][piexif.ExifIFD.UserComment] = toExifAscii(`Megapixels: ${mpVal}`);
    }

    // Clean any proprietary MakerNote binary tags that might cause piexif.dump to fail
    if (exifObj['Exif'][piexif.ExifIFD.MakerNote]) {
      delete exifObj['Exif'][piexif.ExifIFD.MakerNote];
    }

    return exifObj;
  }

  /**
   * Safely dump EXIF object to binary string
   */
  static safeDump(exifObj) {
    try {
      return piexif.dump(exifObj);
    } catch (err) {
      console.warn('First piexif.dump attempt failed, sanitizing problematic tags...', err);
      const cleanObj = {
        '0th': {},
        'Exif': {},
        'GPS': exifObj['GPS'] || {},
        'Interop': {},
        '1st': {},
        'thumbnail': null
      };

      // Retain essential 0th tags
      if (exifObj['0th']) {
        if (exifObj['0th'][piexif.ImageIFD.Make]) cleanObj['0th'][piexif.ImageIFD.Make] = toExifAscii(exifObj['0th'][piexif.ImageIFD.Make]);
        if (exifObj['0th'][piexif.ImageIFD.Model]) cleanObj['0th'][piexif.ImageIFD.Model] = toExifAscii(exifObj['0th'][piexif.ImageIFD.Model]);
        if (exifObj['0th'][piexif.ImageIFD.ImageWidth]) cleanObj['0th'][piexif.ImageIFD.ImageWidth] = exifObj['0th'][piexif.ImageIFD.ImageWidth];
        if (exifObj['0th'][piexif.ImageIFD.ImageLength]) cleanObj['0th'][piexif.ImageIFD.ImageLength] = exifObj['0th'][piexif.ImageIFD.ImageLength];
        if (exifObj['0th'][piexif.ImageIFD.Software]) cleanObj['0th'][piexif.ImageIFD.Software] = toExifAscii(exifObj['0th'][piexif.ImageIFD.Software]);
        if (exifObj['0th'][piexif.ImageIFD.Orientation]) cleanObj['0th'][piexif.ImageIFD.Orientation] = exifObj['0th'][piexif.ImageIFD.Orientation];
        if (exifObj['0th'][piexif.ImageIFD.DateTime]) cleanObj['0th'][piexif.ImageIFD.DateTime] = toExifAscii(exifObj['0th'][piexif.ImageIFD.DateTime]);
        if (exifObj['0th'][piexif.ImageIFD.ImageDescription]) cleanObj['0th'][piexif.ImageIFD.ImageDescription] = toExifAscii(exifObj['0th'][piexif.ImageIFD.ImageDescription]);
        if (exifObj['0th'][piexif.ImageIFD.XResolution]) cleanObj['0th'][piexif.ImageIFD.XResolution] = exifObj['0th'][piexif.ImageIFD.XResolution];
        if (exifObj['0th'][piexif.ImageIFD.YResolution]) cleanObj['0th'][piexif.ImageIFD.YResolution] = exifObj['0th'][piexif.ImageIFD.YResolution];
        if (exifObj['0th'][piexif.ImageIFD.ResolutionUnit]) cleanObj['0th'][piexif.ImageIFD.ResolutionUnit] = exifObj['0th'][piexif.ImageIFD.ResolutionUnit];
      }

      // Retain essential Exif tags
      if (exifObj['Exif']) {
        if (exifObj['Exif'][piexif.ExifIFD.LensModel]) cleanObj['Exif'][piexif.ExifIFD.LensModel] = toExifAscii(exifObj['Exif'][piexif.ExifIFD.LensModel]);
        if (exifObj['Exif'][piexif.ExifIFD.LensMake]) cleanObj['Exif'][piexif.ExifIFD.LensMake] = toExifAscii(exifObj['Exif'][piexif.ExifIFD.LensMake]);
        if (exifObj['Exif'][piexif.ExifIFD.LensSpecification]) cleanObj['Exif'][piexif.ExifIFD.LensSpecification] = exifObj['Exif'][piexif.ExifIFD.LensSpecification];
        if (exifObj['Exif'][piexif.ExifIFD.FocalLength]) cleanObj['Exif'][piexif.ExifIFD.FocalLength] = exifObj['Exif'][piexif.ExifIFD.FocalLength];
        if (exifObj['Exif'][piexif.ExifIFD.FocalLengthIn35mmFilm]) cleanObj['Exif'][piexif.ExifIFD.FocalLengthIn35mmFilm] = exifObj['Exif'][piexif.ExifIFD.FocalLengthIn35mmFilm];
        if (exifObj['Exif'][piexif.ExifIFD.PixelXDimension]) cleanObj['Exif'][piexif.ExifIFD.PixelXDimension] = exifObj['Exif'][piexif.ExifIFD.PixelXDimension];
        if (exifObj['Exif'][piexif.ExifIFD.PixelYDimension]) cleanObj['Exif'][piexif.ExifIFD.PixelYDimension] = exifObj['Exif'][piexif.ExifIFD.PixelYDimension];
        if (exifObj['Exif'][piexif.ExifIFD.UserComment]) cleanObj['Exif'][piexif.ExifIFD.UserComment] = toExifAscii(exifObj['Exif'][piexif.ExifIFD.UserComment]);
        if (exifObj['Exif'][piexif.ExifIFD.ISOSpeedRatings]) cleanObj['Exif'][piexif.ExifIFD.ISOSpeedRatings] = exifObj['Exif'][piexif.ExifIFD.ISOSpeedRatings];
        if (exifObj['Exif'][piexif.ExifIFD.FNumber]) cleanObj['Exif'][piexif.ExifIFD.FNumber] = exifObj['Exif'][piexif.ExifIFD.FNumber];
        if (exifObj['Exif'][piexif.ExifIFD.ExposureTime]) cleanObj['Exif'][piexif.ExifIFD.ExposureTime] = exifObj['Exif'][piexif.ExifIFD.ExposureTime];
        if (exifObj['Exif'][piexif.ExifIFD.DateTimeOriginal]) cleanObj['Exif'][piexif.ExifIFD.DateTimeOriginal] = toExifAscii(exifObj['Exif'][piexif.ExifIFD.DateTimeOriginal]);
        if (exifObj['Exif'][piexif.ExifIFD.DateTimeDigitized]) cleanObj['Exif'][piexif.ExifIFD.DateTimeDigitized] = toExifAscii(exifObj['Exif'][piexif.ExifIFD.DateTimeDigitized]);
        if (exifObj['Exif'][piexif.ExifIFD.ExposureProgram]) cleanObj['Exif'][piexif.ExifIFD.ExposureProgram] = exifObj['Exif'][piexif.ExifIFD.ExposureProgram];
        if (exifObj['Exif'][piexif.ExifIFD.MeteringMode]) cleanObj['Exif'][piexif.ExifIFD.MeteringMode] = exifObj['Exif'][piexif.ExifIFD.MeteringMode];
        if (exifObj['Exif'][piexif.ExifIFD.ColorSpace]) cleanObj['Exif'][piexif.ExifIFD.ColorSpace] = exifObj['Exif'][piexif.ExifIFD.ColorSpace];
        cleanObj['Exif'][piexif.ExifIFD.ExifVersion] = '0232';
      }

      return piexif.dump(cleanObj);
    }
  }

  /**
   * 100% Lossless JPEG EXIF and XMP Segment Modification
   */
  static modifyJpeg(arrayBuffer, metadata, originalInfo) {
    const rawBinary = arrayBufferToBinaryString(arrayBuffer);
    const exifObj = this.buildExifObject(metadata, { ...originalInfo, rawBinary });
    const exifBytes = this.safeDump(exifObj);

    // Clean existing EXIF first to guarantee valid single APP1 header
    let cleanBinary = rawBinary;
    try {
      cleanBinary = piexif.remove(rawBinary);
    } catch (_) {
      // ignore
    }

    let withExifBinary;
    try {
      withExifBinary = piexif.insert(exifBytes, cleanBinary);
    } catch (e1) {
      try {
        withExifBinary = piexif.insert(exifBytes, rawBinary);
      } catch (e2) {
        throw new Error(`JPEG meta veri yazma hatası: ${e2.message || e1.message}`);
      }
    }

    const jpegUint8 = binaryStringToUint8Array(withExifBinary);

    // Build synchronized XMP packet with MicrosoftPhoto & standard tags for Windows Explorer / OS galleries
    const dateStr = (exifObj['Exif'] && exifObj['Exif'][piexif.ExifIFD.DateTimeOriginal]) || getExifDateString();
    const fNumberRat = exifObj['Exif'] && exifObj['Exif'][piexif.ExifIFD.FNumber];
    const fNumStr = (fNumberRat && fNumberRat[1]) ? (fNumberRat[0] / fNumberRat[1]).toFixed(1) : '1.8';
    const expRat = exifObj['Exif'] && exifObj['Exif'][piexif.ExifIFD.ExposureTime];
    const expStr = (expRat && expRat[1]) ? `${expRat[0]}/${expRat[1]}` : '1/500';
    const isoStr = String(exifObj['Exif'] && exifObj['Exif'][piexif.ExifIFD.ISOSpeedRatings] || '100');

    const xmpXml = buildXmpPacket(metadata, dateStr, expStr, fNumStr, isoStr);
    const xmpSegment = createXmpSegment(xmpXml);

    // Inject XMP immediately after EXIF
    const finalJpegUint8 = injectXmpIntoJpeg(jpegUint8, xmpSegment);

    return new Blob([finalJpegUint8], { type: 'image/jpeg' });
  }

  /**
   * 100% Lossless PNG eXIf Chunk Injection / Modification
   */
  static modifyPng(arrayBuffer, metadata, originalInfo) {
    const exifObj = this.buildExifObject(metadata, originalInfo);
    const exifDump = this.safeDump(exifObj);

    // piexif.dump returns APP1 segment containing "Exif\0\0" followed by TIFF header
    // In PNG, the eXIf chunk contains the raw TIFF header and IFDs (excluding the 6-byte "Exif\0\0")
    let tiffBytesStr = exifDump;
    if (tiffBytesStr.startsWith('Exif\0\0')) {
      tiffBytesStr = tiffBytesStr.substring(6);
    }

    const tiffBytes = binaryStringToUint8Array(tiffBytesStr);
    const tiffLength = tiffBytes.length;

    // Create the PNG eXIf chunk:
    // [4 bytes length][4 bytes "eXIf"][tiffLength bytes data][4 bytes CRC32]
    const chunkTotalSize = 12 + tiffLength;
    const chunkBuffer = new Uint8Array(chunkTotalSize);
    const view = new DataView(chunkBuffer.buffer);

    view.setUint32(0, tiffLength, false); // Length (big endian)
    chunkBuffer[4] = 0x65; // 'e'
    chunkBuffer[5] = 0x58; // 'X'
    chunkBuffer[6] = 0x49; // 'I'
    chunkBuffer[7] = 0x66; // 'f'
    chunkBuffer.set(tiffBytes, 8);

    // Compute CRC on chunk type + chunk data
    const chunkCrc = crc32(chunkBuffer, 4, 4 + tiffLength);
    view.setUint32(8 + tiffLength, chunkCrc, false);

    // Read original PNG chunks and insert/replace eXIf
    const srcBytes = new Uint8Array(arrayBuffer);
    const srcView = new DataView(arrayBuffer);

    // Verify PNG signature [137, 80, 78, 71, 13, 10, 26, 10]
    if (srcBytes[0] !== 0x89 || srcBytes[1] !== 0x50 || srcBytes[2] !== 0x4E || srcBytes[3] !== 0x47) {
      const realFmt = detectFormat(arrayBuffer);
      if (realFmt === 'image/jpeg') {
        return this.modifyJpeg(arrayBuffer, metadata, originalInfo);
      } else if (realFmt === 'image/webp') {
        return this.modifyWebP(arrayBuffer, metadata, originalInfo);
      }
      throw new Error('Dosya geçerli bir PNG başlık imzasına sahip değil.');
    }

    const outputParts = [];
    outputParts.push(srcBytes.subarray(0, 8)); // Signature

    let pos = 8;
    let inserted = false;

    while (pos < srcBytes.length) {
      const chunkLen = srcView.getUint32(pos, false);
      const chunkType = String.fromCharCode(
        srcBytes[pos + 4],
        srcBytes[pos + 5],
        srcBytes[pos + 6],
        srcBytes[pos + 7]
      );
      const nextPos = pos + 12 + chunkLen;

      if (chunkType === 'IHDR') {
        // Output IHDR, then immediately insert the new eXIf chunk
        outputParts.push(srcBytes.subarray(pos, nextPos));
        outputParts.push(chunkBuffer);
        inserted = true;
      } else if (chunkType === 'eXIf') {
        // Skip existing eXIf chunk since we inserted the updated one
      } else {
        // Keep all other chunks (IDAT, PLTE, tEXt, IEND, etc.) 100% untouched
        outputParts.push(srcBytes.subarray(pos, nextPos));
      }

      pos = nextPos;
    }

    if (!inserted) {
      outputParts.push(chunkBuffer);
    }

    return new Blob(outputParts, { type: 'image/png' });
  }

  /**
   * 100% Lossless WebP EXIF Chunk Injection / Modification
   */
  static modifyWebP(arrayBuffer, metadata, originalInfo) {
    const exifObj = this.buildExifObject(metadata, originalInfo);
    const exifDump = this.safeDump(exifObj);

    // WebP EXIF chunk payload is raw TIFF or APP1 payload
    let tiffBytesStr = exifDump;
    if (tiffBytesStr.startsWith('Exif\0\0')) {
      tiffBytesStr = tiffBytesStr.substring(6);
    }
    const tiffBytes = binaryStringToUint8Array(tiffBytesStr);
    const exifPayloadLen = tiffBytes.length;

    const srcBytes = new Uint8Array(arrayBuffer);
    const srcView = new DataView(arrayBuffer);

    // Verify RIFF .... WEBP
    const riff = String.fromCharCode(srcBytes[0], srcBytes[1], srcBytes[2], srcBytes[3]);
    const webp = String.fromCharCode(srcBytes[8], srcBytes[9], srcBytes[10], srcBytes[11]);
    if (riff !== 'RIFF' || webp !== 'WEBP') {
      const realFmt = detectFormat(arrayBuffer);
      if (realFmt === 'image/jpeg') return this.modifyJpeg(arrayBuffer, metadata, originalInfo);
      if (realFmt === 'image/png') return this.modifyPng(arrayBuffer, metadata, originalInfo);
      throw new Error('Dosya geçerli bir WebP dosya yapısına sahip değil.');
    }

    // Create EXIF chunk: 'EXIF' (4 bytes), size (4 bytes LE), payload, pad byte if odd
    const padByte = (exifPayloadLen % 2 !== 0) ? 1 : 0;
    const chunkTotalSize = 8 + exifPayloadLen + padByte;
    const exifChunkBytes = new Uint8Array(chunkTotalSize);
    const exifChunkView = new DataView(exifChunkBytes.buffer);

    exifChunkBytes[0] = 0x45; // 'E'
    exifChunkBytes[1] = 0x58; // 'X'
    exifChunkBytes[2] = 0x49; // 'I'
    exifChunkBytes[3] = 0x46; // 'F'
    exifChunkView.setUint32(4, exifPayloadLen, true); // Little endian
    exifChunkBytes.set(tiffBytes, 8);
    if (padByte) {
      exifChunkBytes[8 + exifPayloadLen] = 0;
    }

    // Scan chunks
    let pos = 12;
    const chunks = [];
    let hasVp8x = false;
    let vp8xChunk = null;

    while (pos < srcBytes.length) {
      const fourCC = String.fromCharCode(
        srcBytes[pos],
        srcBytes[pos + 1],
        srcBytes[pos + 2],
        srcBytes[pos + 3]
      );
      const chunkSize = srcView.getUint32(pos + 4, true);
      const chunkPad = (chunkSize % 2 !== 0) ? 1 : 0;
      const fullChunkLen = 8 + chunkSize + chunkPad;

      if (fourCC === 'VP8X') {
        hasVp8x = true;
        // Copy VP8X and set bit 3 (EXIF flag)
        const vp8xData = srcBytes.slice(pos, pos + fullChunkLen);
        vp8xData[8] |= 0x08; // Set EXIF flag
        vp8xChunk = vp8xData;
      } else if (fourCC === 'EXIF') {
        // Skip existing EXIF chunk
      } else {
        chunks.push(srcBytes.subarray(pos, pos + fullChunkLen));
      }

      pos += fullChunkLen;
    }

    // Assemble WebP file
    const assembledParts = [];
    if (hasVp8x && vp8xChunk) {
      assembledParts.push(vp8xChunk);
      for (const c of chunks) assembledParts.push(c);
      assembledParts.push(exifChunkBytes);
    } else {
      // Create VP8X chunk if not present
      const width = (originalInfo.width || 4032) - 1;
      const height = (originalInfo.height || 3024) - 1;
      const vp8x = new Uint8Array(18);
      const vp8xView = new DataView(vp8x.buffer);
      vp8x[0] = 0x56; vp8x[1] = 0x50; vp8x[2] = 0x38; vp8x[3] = 0x58; // 'VP8X'
      vp8xView.setUint32(4, 10, true); // VP8X payload is always 10 bytes
      vp8x[8] = 0x08; // EXIF flag
      // 24-bit canvas width (LE)
      vp8x[12] = width & 0xFF;
      vp8x[13] = (width >> 8) & 0xFF;
      vp8x[14] = (width >> 16) & 0xFF;
      // 24-bit canvas height (LE)
      vp8x[15] = height & 0xFF;
      vp8x[16] = (height >> 8) & 0xFF;
      vp8x[17] = (height >> 16) & 0xFF;

      assembledParts.push(vp8x);
      for (const c of chunks) assembledParts.push(c);
      assembledParts.push(exifChunkBytes);
    }

    // Calculate new total file size (minus 8 bytes for RIFF header)
    let totalPayloadSize = 4; // 'WEBP'
    for (const part of assembledParts) {
      totalPayloadSize += part.byteLength;
    }

    const header = new Uint8Array(12);
    const headerView = new DataView(header.buffer);
    header[0] = 0x52; header[1] = 0x49; header[2] = 0x46; header[3] = 0x46; // 'RIFF'
    headerView.setUint32(4, totalPayloadSize, true);
    header[8] = 0x57; header[9] = 0x45; header[10] = 0x42; header[11] = 0x50; // 'WEBP'

    return new Blob([header, ...assembledParts], { type: 'image/webp' });
  }
}
