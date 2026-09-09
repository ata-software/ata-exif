/**
 * exifReader.js
 * 
 * Extracts complete EXIF, TIFF, GPS, and technical metadata from uploaded images
 * using exifr, while accurately determining native image dimensions and original megapixels.
 */

/* global exifr */

/**
 * Format bytes into human-readable string (e.g. 4.82 MB)
 */
export function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Helper: Read native dimensions from Image object
 */
function getImageDimensions(blobUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0 });
    };
    img.src = blobUrl;
  });
}

/**
 * Helper: Format exposure time into fraction if decimal
 */
function formatExposureTime(exposureTime) {
  if (!exposureTime) return null;
  const val = parseFloat(exposureTime);
  if (isNaN(val)) return String(exposureTime);
  if (val >= 1) return `${val.toFixed(1)}s`;
  const denominator = Math.round(1 / val);
  return `1/${denominator}s`;
}

/**
 * Detect real binary file format using magic bytes
 */
export function detectFormat(arrayBuffer) {
  if (!arrayBuffer || arrayBuffer.byteLength < 4) return null;
  const bytes = new Uint8Array(arrayBuffer.slice(0, 16));

  // JPEG: FF D8 (SOI marker)
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return 'image/png';
  }

  // WebP: RIFF .... WEBP
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
      return 'image/webp';
    }
  }

  // HEIC / HEIF: ftyp at bytes 4..7
  if (bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return 'image/heic';
  }

  return null;
}

export class ExifReader {
  /**
   * Parse an image file and return its complete metadata and diagnostic info.
   * 
   * @param {File|Blob} file 
   * @returns {Promise<Object>}
   */
  static async parseImage(file) {
    const arrayBuffer = await file.arrayBuffer();
    const detectedMime = detectFormat(arrayBuffer) || file.type || 'image/jpeg';

    let previewBlob = file;
    let workingBuffer = arrayBuffer;
    let isConvertedHeic = false;

    // HEIC / HEIF formatı kontrolü ve tarayıcı önizleme dönüşümü
    const isHeic = detectedMime === 'image/heic' || 
                   (file.name && (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')));

    if (isHeic) {
      /* global heic2any */
      if (typeof heic2any !== 'undefined') {
        try {
          const converted = await heic2any({
            blob: file,
            toType: 'image/jpeg',
            quality: 0.98
          });
          previewBlob = Array.isArray(converted) ? converted[0] : converted;
          workingBuffer = await previewBlob.arrayBuffer();
          isConvertedHeic = true;
        } catch (err) {
          console.warn('heic2any dönüştürme uyarısı:', err);
        }
      }
    }

    const blobUrl = URL.createObjectURL(previewBlob);

    // 1. Get native dimensions
    let dimensions = await getImageDimensions(blobUrl);

    // 2. Extract full metadata via exifr
    let rawTags = {};
    let gpsTags = {};
    try {
      rawTags = await exifr.parse(arrayBuffer, {
        tiff: true,
        xmp: true,
        icc: true,
        iptc: true,
        jfif: true,
        translateValues: false,
        reviveValues: false
      }) || {};
    } catch (e) {
      console.warn('exifr parse encountered issue or image has no standard EXIF:', e);
    }

    try {
      gpsTags = await exifr.gps(arrayBuffer) || null;
    } catch (e) {
      // GPS not available
    }

    // 3. Megapiksel ve Çözünürlük Tespiti:
    // Dosyada önceden yazılmış özel MP veya EXIF boyut etiketlerini kontrol et
    let explicitMp = null;
    const desc = String(rawTags.ImageDescription || rawTags.description || '');
    const userComment = String(rawTags.UserComment || '');
    const software = String(rawTags.Software || '');
    const mpRegex = /(?:Megapixels?|MP)[\s:=]+([\d.]+)/i;
    const mpMatch = desc.match(mpRegex) || userComment.match(mpRegex) || software.match(mpRegex);
    if (mpMatch && mpMatch[1]) {
      const parsedVal = parseFloat(mpMatch[1]);
      if (!isNaN(parsedVal) && parsedVal > 0) {
        explicitMp = parsedVal;
      }
    }

    const exifWidth = rawTags.PixelXDimension || rawTags.ExifImageWidth || rawTags.ImageWidth;
    const exifHeight = rawTags.PixelYDimension || rawTags.ExifImageHeight || rawTags.ImageLength;

    // Boyut belirleme: Eğer EXIF boyutları mevcutsa (düzenlenmiş veya orijinal EXIF),
    // bunu temel al; aksi halde taranan ham piksel boyutunu kullan.
    let width = 0;
    let height = 0;
    if (exifWidth && exifHeight && exifWidth > 0 && exifHeight > 0) {
      width = exifWidth;
      height = exifHeight;
    } else {
      width = dimensions.width || exifWidth || 0;
      height = dimensions.height || exifHeight || 0;
    }

    // 4. Megapiksel Hesabı:
    // Eğer özel bir MP kaydedilmişse (örn. 999999 MP), tam olarak o değeri kullan!
    let calculatedMegapixels = 0;
    if (explicitMp !== null) {
      calculatedMegapixels = explicitMp;
    } else if (width > 0 && height > 0) {
      const comp = (width * height) / 1000000;
      calculatedMegapixels = (comp >= 100) ? Math.round(comp) : parseFloat(comp.toFixed(2));
    }

    // 5. Parse Focal Length
    let focalLength = null;
    if (rawTags.FocalLength !== undefined && rawTags.FocalLength !== null) {
      if (typeof rawTags.FocalLength === 'number') {
        focalLength = parseFloat(rawTags.FocalLength.toFixed(1));
      } else if (Array.isArray(rawTags.FocalLength) && rawTags.FocalLength.length === 2) {
        focalLength = parseFloat((rawTags.FocalLength[0] / rawTags.FocalLength[1]).toFixed(1));
      } else {
        focalLength = parseFloat(rawTags.FocalLength);
      }
    }

    // 6. Camera & Lens strings
    const make = rawTags.Make ? String(rawTags.Make).replace(/\0/g, '').trim() : '';
    const model = rawTags.Model ? String(rawTags.Model).replace(/\0/g, '').trim() : '';
    const lensModel = rawTags.LensModel ? String(rawTags.LensModel).replace(/\0/g, '').trim() : '';
    const lensMake = rawTags.LensMake ? String(rawTags.LensMake).replace(/\0/g, '').trim() : '';

    // 7. Technical camera settings
    const iso = rawTags.ISO || rawTags.ISOSpeedRatings || null;
    const fNumber = rawTags.FNumber ? parseFloat(rawTags.FNumber.toFixed(2)) : null;
    const exposureTime = formatExposureTime(rawTags.ExposureTime);
    const dateTaken = rawTags.DateTimeOriginal || rawTags.CreateDate || rawTags.DateTime || null;
    const orientation = rawTags.Orientation || 1;
    const flash = rawTags.Flash !== undefined ? rawTags.Flash : null;
    const whiteBalance = rawTags.WhiteBalance !== undefined ? rawTags.WhiteBalance : null;

    // 8. Generate raw binary string for piexif
    let rawBinary = '';
    const bytes = new Uint8Array(arrayBuffer);
    const chunk = 8192;
    for (let i = 0; i < bytes.byteLength; i += chunk) {
      rawBinary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunk, bytes.byteLength)));
    }

    return {
      file,
      name: file.name || 'image.jpg',
      size: file.size,
      formattedSize: formatBytes(file.size),
      mimeType: detectedMime,
      detectedMime,
      isConvertedHeic,
      workingBuffer,
      blobUrl,
      rawPixelWidth: dimensions.width || width,
      rawPixelHeight: dimensions.height || height,
      width,
      height,
      resolution: `${width} × ${height}`,
      calculatedMegapixels,
      make,
      model,
      lensModel,
      lensMake,
      focalLength,
      focalLengthIn35mm: rawTags.FocalLengthIn35mmFilm || null,
      iso,
      fNumber,
      exposureTime,
      dateTaken,
      orientation,
      flash,
      whiteBalance,
      gps: gpsTags,
      allTags: rawTags,
      rawBinary
    };
  }
}
