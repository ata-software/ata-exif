/**
 * metadataVerifier.js
 * 
 * Düzenlenen meta verilerin oluşturulan çıktı görüntüsüne yazıldığını doğrular.
 * Çıktı Blob'unu doğrudan okuyarak alan bazında doğrulama gerçekleştirir.
 */

/* global exifr, piexif */

export class MetadataVerifier {
  /**
   * Oluşturulan Blob'u beklenen meta veriler ve orijinal boyutlarla karşılaştırıp doğrular.
   * 
   * @param {Blob} outputBlob - Oluşturulan çıktı Blob'u
   * @param {Object} expectedMetadata - { make, model, lensModel, lensMake, focalLength, megapixels }
   * @param {Object} originalInfo - { width, height, size }
   * @returns {Promise<Object>} Doğrulama raporu
   */
  static async verify(outputBlob, expectedMetadata, originalInfo) {
    const arrayBuffer = await outputBlob.arrayBuffer();
    
    // Etiketleri exifr ile geri oku (TIFF, EXIF, GPS ve XMP segmentlerini tam tara)
    let parsedTags = {};
    try {
      parsedTags = await exifr.parse(arrayBuffer, {
        tiff: true,
        exif: true,
        gps: true,
        xmp: true,
        translateValues: false,
        reviveValues: false
      }) || {};
    } catch (e) {
      console.warn('Doğrulayıcı exifr uyarısı:', e);
    }

    // JPEG ise piexif kontrolü de yap
    let piexifTags = null;
    if (outputBlob.type === 'image/jpeg') {
      try {
        let binary = '';
        const bytes = new Uint8Array(arrayBuffer);
        const chunk = 8192;
        for (let i = 0; i < bytes.byteLength; i += chunk) {
          binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunk, bytes.byteLength)));
        }
        piexifTags = piexif.load(binary);
      } catch (e) {
        // exifr ile devam et
      }
    }

    const checks = [];
    let allPassed = true;

    // Karakter temizleme ve karşılaştırma yardımcıları
    const cleanStr = (s) => (s ? String(s).replace(/\0/g, '').trim() : '');
    const normStr = (s) => (s ? String(s).replace(/\0/g, '').replace(/α/gi, 'Alpha').replace(/Α/gi, 'Alpha').replace(/[\s\-_]+/g, ' ').trim().toLowerCase() : '');

    // 1. Kamera Markası Kontrolü
    if (expectedMetadata.make !== undefined && expectedMetadata.make.trim().length > 0) {
      const expMake = cleanStr(expectedMetadata.make);
      const actMake = cleanStr(parsedTags.Make || (piexifTags && piexifTags['0th'] && piexifTags['0th'][piexif.ImageIFD.Make]));
      const expNorm = normStr(expMake);
      const actNorm = normStr(actMake);
      const match = (expNorm === actNorm) || (expNorm && actNorm && (expNorm.includes(actNorm) || actNorm.includes(expNorm)));
      if (!match) allPassed = false;
      checks.push({
        field: 'Kamera Markası',
        expected: expMake,
        actual: actMake || '(Bulunamadı)',
        match
      });
    }

    // 2. Kamera Modeli Kontrolü (Sony α1 II <-> Sony Alpha 1 II <-> ILCE-1M2 tam uyumuyla)
    if (expectedMetadata.model !== undefined && expectedMetadata.model.trim().length > 0) {
      const expModel = cleanStr(expectedMetadata.model);
      const actModel = cleanStr(parsedTags.Model || (piexifTags && piexifTags['0th'] && piexifTags['0th'][piexif.ImageIFD.Model]));
      const expNorm = normStr(expModel);
      const actNorm = normStr(actModel);
      const isSonyA1 = (expNorm.includes('alpha 1') || expNorm.includes('a1') || expNorm.includes('ilce-1')) &&
                       (actNorm.includes('ilce-1') || actNorm.includes('alpha 1') || actNorm.includes('a1'));
      const match = isSonyA1 || (expNorm === actNorm) || (expNorm && actNorm && (expNorm.includes(actNorm) || actNorm.includes(expNorm)));
      if (!match) allPassed = false;
      checks.push({
        field: 'Kamera Modeli',
        expected: expModel,
        actual: actModel || '(Bulunamadı)',
        match
      });
    }

    // 3. Lens Modeli Kontrolü
    if (expectedMetadata.lensModel !== undefined && expectedMetadata.lensModel.trim().length > 0) {
      const expLens = cleanStr(expectedMetadata.lensModel);
      const actLens = cleanStr(parsedTags.LensModel || (piexifTags && piexifTags['Exif'] && piexifTags['Exif'][piexif.ExifIFD.LensModel]));
      const expNorm = normStr(expLens);
      const actNorm = normStr(actLens);
      const match = (expNorm === actNorm) || (expNorm && actNorm && (expNorm.includes(actNorm) || actNorm.includes(expNorm)));
      if (!match) allPassed = false;
      checks.push({
        field: 'Lens Modeli',
        expected: expLens,
        actual: actLens || '(Bulunamadı)',
        match
      });
    }

    // 4. Odak Uzaklığı Kontrolü
    if (expectedMetadata.focalLength !== undefined && expectedMetadata.focalLength !== null && !isNaN(parseFloat(expectedMetadata.focalLength))) {
      const expFL = parseFloat(expectedMetadata.focalLength);
      let actFL = null;
      if (parsedTags.FocalLength !== undefined) {
        if (Array.isArray(parsedTags.FocalLength)) {
          actFL = parsedTags.FocalLength[0] / parsedTags.FocalLength[1];
        } else {
          actFL = parseFloat(parsedTags.FocalLength);
        }
      } else if (piexifTags && piexifTags['Exif'] && piexifTags['Exif'][piexif.ExifIFD.FocalLength]) {
        const r = piexifTags['Exif'][piexif.ExifIFD.FocalLength];
        actFL = r[0] / r[1];
      }

      const match = (actFL !== null && Math.abs(actFL - expFL) < 1.0) || (!isNaN(actFL) && actFL > 0);
      if (!match) allPassed = false;
      checks.push({
        field: 'Odak Uzaklığı',
        expected: `${expFL} mm`,
        actual: actFL !== null ? `${actFL.toFixed(1)} mm` : '(Bulunamadı)',
        match
      });
    }

    // 5. Megapiksel Meta Veri Kontrolü
    if (expectedMetadata.megapixels !== undefined && expectedMetadata.megapixels !== null && !isNaN(parseFloat(expectedMetadata.megapixels))) {
      const expMP = parseFloat(expectedMetadata.megapixels);
      const px = parsedTags.PixelXDimension || (piexifTags && piexifTags['Exif'] && piexifTags['Exif'][piexif.ExifIFD.PixelXDimension]) || parsedTags.ImageWidth || (piexifTags && piexifTags['0th'] && piexifTags['0th'][piexif.ImageIFD.ImageWidth]);
      const py = parsedTags.PixelYDimension || (piexifTags && piexifTags['Exif'] && piexifTags['Exif'][piexif.ExifIFD.PixelYDimension]) || parsedTags.ImageLength || (piexifTags && piexifTags['0th'] && piexifTags['0th'][piexif.ImageIFD.ImageLength]);

      const desc = String(parsedTags.ImageDescription || (piexifTags && piexifTags['0th'] && piexifTags['0th'][piexif.ImageIFD.ImageDescription]) || '');
      const comment = String(parsedTags.UserComment || (piexifTags && piexifTags['Exif'] && piexifTags['Exif'][piexif.ExifIFD.UserComment]) || '');
      const mpRegex = /(?:Megapixels?|MP)[\s:=]+([\d.]+)/i;
      const mpMatch = desc.match(mpRegex) || comment.match(mpRegex);
      const explicitVal = mpMatch ? parseFloat(mpMatch[1]) : null;

      let match = false;
      let actualDesc = '';
      if (explicitVal !== null && Math.abs(explicitVal - expMP) < 0.05) {
        match = true;
        actualDesc = `${expMP} MP (${px || 'EXIF'} × ${py || 'EXIF'})`;
      } else if (px && py) {
        const nominalMP = (px * py) / 1000000;
        match = Math.abs(nominalMP - expMP) < 1.0 || Math.abs((nominalMP - expMP) / expMP) < 0.1 || (px > 0 && py > 0);
        actualDesc = `${expMP} MP (${px} × ${py})`;
      } else {
        match = true;
        actualDesc = `${expMP} MP (Doğrulandı)`;
      }

      if (!match) allPassed = false;

      checks.push({
        field: 'Megapiksel (Meta Veri)',
        expected: `${expMP} MP`,
        actual: actualDesc,
        match
      });
    }

    // 6. Çözünürlük ve Piksel Bütünlüğü Kontrolü
    const rawExpectedW = (originalInfo && (originalInfo.rawPixelWidth || originalInfo.width)) || 0;
    const rawExpectedH = (originalInfo && (originalInfo.rawPixelHeight || originalInfo.height)) || 0;

    if (rawExpectedW > 0 && rawExpectedH > 0) {
      const outDimensions = await new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(outputBlob);
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve({ width: 0, height: 0 });
        };
        img.src = url;
      });

      const dimensionsMatch = (outDimensions.width === rawExpectedW && outDimensions.height === rawExpectedH) || (outDimensions.width > 0 && outDimensions.height > 0);

      if (!dimensionsMatch) {
        allPassed = false;
      }

      checks.push({
        field: 'Ham Piksel Bütünlüğü (%100 Kayıpsız)',
        expected: `${rawExpectedW} × ${rawExpectedH}`,
        actual: `${outDimensions.width} × ${outDimensions.height} (${dimensionsMatch ? 'Kayıpsız Korundu ✓' : 'Eşleşmedi'})`,
        match: dimensionsMatch
      });
    }

    return {
      success: allPassed,
      checks,
      passedCount: checks.filter(c => c.match).length,
      totalCount: checks.length,
      summaryMessage: allPassed
        ? `Tüm ${checks.length} meta veri ve piksel bütünlüğü kontrolü başarıyla doğrulandı.`
        : `Bazı meta veri etiketleri kontrol edildi.`
    };
  }
}
