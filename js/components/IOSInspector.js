/**
 * IOSInspector.js
 * 
 * Apple Photos stili Detaylı Teknik EXIF & Meta Veri İnceleme sayfası.
 */

export class IOSInspector {
  static init() {
    const overlay = document.getElementById('inspector-modal-overlay');
    const closeBtn = document.getElementById('inspector-modal-close');
    if (closeBtn && overlay) {
      closeBtn.addEventListener('click', () => {
        overlay.classList.remove('show');
      });
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('show');
        }
      });
    }
  }

  static show(currentImageInfo) {
    const overlay = document.getElementById('inspector-modal-overlay');
    const body = document.getElementById('inspector-modal-body');
    if (!overlay || !body || !currentImageInfo) return;

    const gps = currentImageInfo.gps || null;

    let gpsHtml = '<span class="ios-row-value">Kaydedilmemiş</span>';
    if (gps && gps.latitude && gps.longitude) {
      const lat = gps.latitude.toFixed(5);
      const lon = gps.longitude.toFixed(5);
      gpsHtml = `
        <span class="ios-row-value" style="color: var(--ios-blue);">
          ${lat}, ${lon}
        </span>
      `;
    }

    body.innerHTML = `
      <!-- Cihaz ve Lens -->
      <div class="ios-section">
        <div class="ios-section-header">Cihaz ve Lens</div>
        <div class="ios-card">
          <div class="ios-row">
            <span class="ios-row-title">Kamera Markası</span>
            <span class="ios-row-value">${currentImageInfo.make || 'Boş'}</span>
          </div>
          <div class="ios-row">
            <span class="ios-row-title">Kamera Modeli</span>
            <span class="ios-row-value">${currentImageInfo.model || 'Boş'}</span>
          </div>
          <div class="ios-row">
            <span class="ios-row-title">Lens Modeli</span>
            <span class="ios-row-value">${currentImageInfo.lensModel || 'Boş'}</span>
          </div>
          <div class="ios-row">
            <span class="ios-row-title">Lens Markası</span>
            <span class="ios-row-value">${currentImageInfo.lensMake || 'Boş'}</span>
          </div>
        </div>
      </div>

      <!-- Pozlama ve Optik -->
      <div class="ios-section">
        <div class="ios-section-header">Pozlama ve Optik</div>
        <div class="ios-card">
          <div class="ios-row">
            <span class="ios-row-title">Odak Uzaklığı</span>
            <span class="ios-row-value">${currentImageInfo.focalLength ? currentImageInfo.focalLength + ' mm' : 'Boş'}</span>
          </div>
          <div class="ios-row">
            <span class="ios-row-title">35mm Eşdeğeri</span>
            <span class="ios-row-value">${currentImageInfo.focalLengthIn35mm ? currentImageInfo.focalLengthIn35mm + ' mm' : 'Boş'}</span>
          </div>
          <div class="ios-row">
            <span class="ios-row-title">Diyafram (Apertür)</span>
            <span class="ios-row-value">${currentImageInfo.fNumber ? 'ƒ/' + currentImageInfo.fNumber : 'Boş'}</span>
          </div>
          <div class="ios-row">
            <span class="ios-row-title">Enstantane Hızı</span>
            <span class="ios-row-value">${currentImageInfo.exposureTime || 'Boş'}</span>
          </div>
          <div class="ios-row">
            <span class="ios-row-title">ISO Değeri</span>
            <span class="ios-row-value">${currentImageInfo.iso || 'Boş'}</span>
          </div>
        </div>
      </div>

      <!-- Görüntü Özellikleri -->
      <div class="ios-section">
        <div class="ios-section-header">Görüntü Özellikleri</div>
        <div class="ios-card">
          <div class="ios-row">
            <span class="ios-row-title">Çözünürlük</span>
            <span class="ios-row-value">${currentImageInfo.resolution}</span>
          </div>
          <div class="ios-row">
            <span class="ios-row-title">Megapiksel</span>
            <span class="ios-row-value">${currentImageInfo.calculatedMegapixels} MP</span>
          </div>
          <div class="ios-row">
            <span class="ios-row-title">Dosya Boyutu</span>
            <span class="ios-row-value">${currentImageInfo.formattedSize}</span>
          </div>
          <div class="ios-row">
            <span class="ios-row-title">Dosya Formatı</span>
            <span class="ios-row-value">${currentImageInfo.mimeType}</span>
          </div>
          <div class="ios-row">
            <span class="ios-row-title">Çekim Tarihi</span>
            <span class="ios-row-value">${currentImageInfo.dateTaken || 'Kaydedilmemiş'}</span>
          </div>
          <div class="ios-row">
            <span class="ios-row-title">Konum (GPS)</span>
            ${gpsHtml}
          </div>
        </div>
        <div class="ios-section-footer">
          🔒 Mevcut tüm teknik meta veriler (pozlama, çekim tarihi, renk profili vb.) kayıpsız korunmaktadır.
        </div>
      </div>
    `;

    overlay.classList.add('show');
  }
}
