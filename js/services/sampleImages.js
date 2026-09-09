import { toExifAscii, buildXmpPacket, createXmpSegment, injectXmpIntoJpeg } from './exifWriter.js?v=4.0';

/* global piexif */

export class SampleImageService {
  /**
   * Create a sample image with authentic EXIF and XMP metadata
   */
  static async createSample(type = 'iphone') {
    const isIphone = type === 'iphone';
    
    // Mobil ve masaüstü tarayıcılarda ultra hızlı (< 20ms) ve keskin tuval çözünürlüğü
    const width = 2400;
    const height = isIphone ? 1800 : 1600;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Tuval bağlamı oluşturulamadı.');

    const scale = width / 1200;

    if (isIphone) {
      // Warm sunset cityscape gradient for iPhone
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#0F2027');
      grad.addColorStop(0.3, '#203A43');
      grad.addColorStop(0.6, '#2C5364');
      grad.addColorStop(0.85, '#FF8008');
      grad.addColorStop(1, '#FFC837');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Distant skyline
      ctx.fillStyle = 'rgba(15, 32, 39, 0.75)';
      ctx.beginPath();
      ctx.moveTo(0, height * 0.75);
      ctx.lineTo(width * 0.2, height * 0.65);
      ctx.lineTo(width * 0.45, height * 0.72);
      ctx.lineTo(width * 0.7, height * 0.60);
      ctx.lineTo(width * 0.78, height * 0.78);
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();

      // Sun glow
      const sunGrad = ctx.createRadialGradient(width * 0.7, height * 0.55, 10 * scale, width * 0.7, height * 0.55, 180 * scale);
      sunGrad.addColorStop(0, 'rgba(255, 230, 150, 0.9)');
      sunGrad.addColorStop(0.4, 'rgba(255, 140, 0, 0.4)');
      sunGrad.addColorStop(1, 'rgba(255, 100, 0, 0)');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(width * 0.7, height * 0.55, 180 * scale, 0, Math.PI * 2);
      ctx.fill();

      // Title overlay
      ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
      ctx.font = `bold ${Math.round(38 * scale)}px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif`;
      ctx.fillText('Cupertino Sunset · Sample Shot', 50 * scale, 90 * scale);
      ctx.font = `${Math.round(22 * scale)}px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
      ctx.fillText('Shot on iPhone 17 Pro · 24mm f/1.78 · 48 MP', 50 * scale, 135 * scale);
    } else {
      // Cinematic studio dark charcoal / amber / gold for Sony α1 II
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#0E0D12');
      grad.addColorStop(0.35, '#1A1824');
      grad.addColorStop(0.7, '#2F2026');
      grad.addColorStop(1, '#662233');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Studio light bokeh circles
      ctx.fillStyle = 'rgba(255, 180, 140, 0.20)';
      ctx.beginPath();
      ctx.arc(width * 0.3, height * 0.4, 160 * scale, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 215, 160, 0.22)';
      ctx.beginPath();
      ctx.arc(width * 0.75, height * 0.35, 130 * scale, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
      ctx.font = `bold ${Math.round(38 * scale)}px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif`;
      ctx.fillText('Studio Portrait · Sample Shot', 50 * scale, 90 * scale);
      ctx.font = `${Math.round(22 * scale)}px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
      ctx.fillText('Sony Alpha 1 II · FE 50mm F1.2 GM · 50 MP', 50 * scale, 135 * scale);
    }

    // 2. Export canvas to basic JPEG DataURL
    const baseDataUrl = canvas.toDataURL('image/jpeg', 0.92);

    // 3. Construct rich EXIF metadata
    const exifObj = {
      '0th': {},
      'Exif': {},
      'GPS': {},
      'Interop': {},
      '1st': {},
      'thumbnail': null
    };

    const make = isIphone ? 'Apple' : 'Sony';
    const model = isIphone ? 'iPhone 16 Pro' : 'ILCE-1M2';
    const lensMake = make;
    const lensModel = isIphone ? 'iPhone 16 Pro back camera 24mm f/1.78' : 'Sony FE 50mm F1.2 GM';
    const focalLength = isIphone ? 24 : 50;
    const megapixels = isIphone ? 48 : 50;
    const dateStr = isIphone ? '2026:09:01 19:20:15' : '2026:08:25 14:10:30';

    exifObj['0th'][piexif.ImageIFD.Make] = toExifAscii(make);
    exifObj['0th'][piexif.ImageIFD.Model] = toExifAscii(model);
    exifObj['0th'][50708] = toExifAscii(isIphone ? 'iPhone 16 Pro' : 'Sony Alpha 1 II');
    exifObj['0th'][piexif.ImageIFD.ImageWidth] = isIphone ? 8064 : 8640;
    exifObj['0th'][piexif.ImageIFD.ImageLength] = isIphone ? 6048 : 5760;
    exifObj['0th'][piexif.ImageIFD.ImageDescription] = toExifAscii(`Megapixels: ${megapixels}`);
    exifObj['0th'][piexif.ImageIFD.Software] = toExifAscii(isIphone ? '18.2' : 'ILCE-1M2 v1.00');
    exifObj['0th'][piexif.ImageIFD.Orientation] = 1;
    exifObj['0th'][piexif.ImageIFD.DateTime] = toExifAscii(dateStr);
    exifObj['0th'][piexif.ImageIFD.XResolution] = [72, 1];
    exifObj['0th'][piexif.ImageIFD.YResolution] = [72, 1];
    exifObj['0th'][piexif.ImageIFD.ResolutionUnit] = 2;

    exifObj['Exif'][piexif.ExifIFD.LensMake] = toExifAscii(lensMake);
    exifObj['Exif'][piexif.ExifIFD.LensModel] = toExifAscii(lensModel);
    exifObj['Exif'][piexif.ExifIFD.FocalLength] = [focalLength * 10, 10];
    exifObj['Exif'][piexif.ExifIFD.FocalLengthIn35mmFilm] = focalLength;
    exifObj['Exif'][piexif.ExifIFD.FNumber] = isIphone ? [178, 100] : [120, 100];
    exifObj['Exif'][piexif.ExifIFD.ISOSpeedRatings] = isIphone ? 50 : 100;
    exifObj['Exif'][piexif.ExifIFD.ExposureTime] = isIphone ? [1, 500] : [1, 1250];
    exifObj['Exif'][piexif.ExifIFD.DateTimeOriginal] = toExifAscii(dateStr);
    exifObj['Exif'][piexif.ExifIFD.DateTimeDigitized] = toExifAscii(dateStr);
    exifObj['Exif'][piexif.ExifIFD.PixelXDimension] = isIphone ? 8064 : 8640;
    exifObj['Exif'][piexif.ExifIFD.PixelYDimension] = isIphone ? 6048 : 5760;
    exifObj['Exif'][piexif.ExifIFD.UserComment] = toExifAscii(`Megapixels: ${megapixels}`);
    exifObj['Exif'][piexif.ExifIFD.ExifVersion] = '0232';
    exifObj['Exif'][piexif.ExifIFD.ColorSpace] = 1;
    exifObj['Exif'][piexif.ExifIFD.ExposureProgram] = 2;
    exifObj['Exif'][piexif.ExifIFD.MeteringMode] = 5;

    const flRat = [focalLength * 10, 10];
    const apRat = isIphone ? [178, 100] : [120, 100];
    exifObj['Exif'][piexif.ExifIFD.LensSpecification] = [flRat, flRat, apRat, apRat];

    // 4. Dump and insert EXIF into JPEG
    let finalDataUrl = baseDataUrl;
    try {
      const exifBytes = piexif.dump(exifObj);
      finalDataUrl = piexif.insert(exifBytes, baseDataUrl);
    } catch (dumpErr) {
      console.warn('Örnek EXIF dump sanitizing:', dumpErr);
    }

    // 5. Convert DataURL to Uint8Array and inject synchronized XMP APP1
    const byteString = atob(finalDataUrl.split(',')[1]);
    const uint8 = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
      uint8[i] = byteString.charCodeAt(i);
    }

    const expStr = isIphone ? '1/500' : '1/1250';
    const fNumStr = isIphone ? '1.78' : '1.2';
    const isoStr = isIphone ? '50' : '100';

    const xmpXml = buildXmpPacket(
      { make, model, lensMake, lensModel, focalLength },
      dateStr,
      expStr,
      fNumStr,
      isoStr
    );
    const xmpSegment = createXmpSegment(xmpXml);
    const finalJpeg = injectXmpIntoJpeg(uint8, xmpSegment);

    const filename = isIphone ? 'IMG_1701_iPhone17Pro.jpg' : 'DSC0001_Sony_a1_II.jpg';
    return new File([finalJpeg], filename, { type: 'image/jpeg' });
  }
}

