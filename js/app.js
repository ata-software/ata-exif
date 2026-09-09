/**
 * app.js
 * 
 * Apple Stili EXIF Düzenleyici Ana Uygulama Kontrolcüsü.
 * Dosya yükleme, kayıpsız ikili meta veri manipülasyonu, gerçek zamanlı karşılaştırma,
 * kayıt sonrası doğrulama ve kullanıcı arayüzü geçişlerini yönetir.
 * Tema yönetimi: Sadece Aydınlık (Light) ve Karanlık (Dark) modlar (Oto modu kaldırılmıştır).
 */

import { ExifReader, formatBytes } from './services/exifReader.js?v=4.1';
import { ExifWriter } from './services/exifWriter.js?v=4.1';
import { MetadataVerifier } from './services/metadataVerifier.js?v=4.1';
import { SampleImageService } from './services/sampleImages.js?v=4.1';
import { IOSToast } from './components/IOSToast.js?v=4.1';
import { IOSInspector } from './components/IOSInspector.js?v=4.1';

class AppController {
  constructor() {
    this.currentImageInfo = null;
    this.currentEditedBlob = null;
    this.currentTheme = 'light';

    this.initElements();
    this.initEventListeners();
    this.initTheme();
    this.initPWA();
    IOSInspector.init();

    // Başlangıçta kaydırmasız tam ekran modunu sağla
    document.body.classList.remove('has-editor');
    if (this.appContainer) {
      this.appContainer.classList.remove('has-editor');
    }
  }

  initPWA() {
    const updateStandalone = () => {
      const isStandalone = window.navigator.standalone === true ||
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches;
      if (isStandalone) {
        document.documentElement.classList.add('is-standalone');
      } else {
        document.documentElement.classList.remove('is-standalone');
      }
    };
    updateStandalone();

    try {
      const mql = window.matchMedia('(display-mode: standalone)');
      if (mql.addEventListener) {
        mql.addEventListener('change', updateStandalone);
      }
    } catch (e) { }

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch((err) => {
          console.warn('PWA Service Worker kaydı atlandı:', err);
        });
      });
    }
  }

  initElements() {
    // Görünümler ve Düzen
    this.appContainer = document.querySelector('.app-container');
    this.emptyStateView = document.getElementById('empty-state-view');
    this.editorView = document.getElementById('editor-view');
    this.bottomActionBar = document.getElementById('bottom-action-bar');
    this.uploadCardZone = document.getElementById('upload-card-zone');
    this.fileInput = document.getElementById('file-input');

    // Eylem Düğmeleri
    this.browseBtn = document.getElementById('browse-btn');
    this.replacePhotoBtn = document.getElementById('replace-photo-btn');
    this.navBackBtn = document.getElementById('nav-back-btn');
    this.backBar = document.getElementById('ios-back-bar');
    this.editorBackBtn = document.getElementById('editor-back-btn');
    this.inspectExifBtn = document.getElementById('inspect-exif-btn');
    this.saveImageBtn = document.getElementById('save-image-btn');
    this.saveBtnText = document.getElementById('save-btn-text');
    this.saveBtnSpinner = document.getElementById('save-btn-spinner');
    this.saveBtnIcon = document.getElementById('save-btn-icon');

    // Uygulama İçi Galeriye Kaydetme Modalı Elemanları
    this.saveModalOverlay = document.getElementById('save-modal-overlay');
    this.saveModalImage = document.getElementById('save-modal-image');
    this.saveModalClose = document.getElementById('save-modal-close');
    this.saveModalShareBtn = document.getElementById('save-modal-share-btn');
    this.saveModalDownloadBtn = document.getElementById('save-modal-download-btn');
    this.latestSavedBlob = null;
    this.latestSavedFilename = '';

    // Tek Tuş Tema Değiştirici Butonu
    this.themeToggleBtn = document.getElementById('theme-toggle-btn');
    this.themeToggleIcon = document.getElementById('theme-toggle-icon');
    this.themeToggleText = document.getElementById('theme-toggle-text');

    // Örnek Fotoğraf Düğmeleri
    this.sampleIphoneBtn = document.getElementById('sample-iphone-btn');
    this.sampleSonyBtn = document.getElementById('sample-sony-btn') || document.getElementById('sample-canon-btn');

    // Önizleme Alanı
    this.previewImage = document.getElementById('preview-image');
    this.previewBadge = document.getElementById('preview-badge');

    // Fotoğraf Bilgileri Alanı
    this.infoResolution = document.getElementById('info-resolution');
    this.infoMegapixels = document.getElementById('info-megapixels');
    this.infoOriginalSize = document.getElementById('info-original-size');
    this.infoProcessedSize = document.getElementById('info-processed-size');
    this.infoFormat = document.getElementById('info-format');

    // Giriş Alanları
    this.inputCameraMake = document.getElementById('input-camera-make');
    this.inputCameraModel = document.getElementById('input-camera-model');
    this.inputLensModel = document.getElementById('input-lens-model');
    this.inputLensMake = document.getElementById('input-lens-make');
    this.inputMegapixels = document.getElementById('input-megapixels');
    this.inputFocalLength = document.getElementById('input-focal-length');

    // Öncesi / Sonrası Karşılaştırma Alanı
    this.diffOrigCamera = document.getElementById('diff-orig-camera');
    this.diffOrigModel = document.getElementById('diff-orig-model');
    this.diffOrigLens = document.getElementById('diff-orig-lens');
    this.diffOrigMp = document.getElementById('diff-orig-mp');
    this.diffOrigFl = document.getElementById('diff-orig-fl');

    this.diffEditCamera = document.getElementById('diff-edit-camera');
    this.diffEditModel = document.getElementById('diff-edit-model');
    this.diffEditLens = document.getElementById('diff-edit-lens');
    this.diffEditMp = document.getElementById('diff-edit-mp');
    this.diffEditFl = document.getElementById('diff-edit-fl');

    // Doğrulama Alanı
    this.verificationSection = document.getElementById('verification-section');
    this.verificationStatusPill = document.getElementById('verification-status-pill');
    this.verificationList = document.getElementById('verification-list');
  }

  initEventListeners() {
    // Dosya Yükleme Olayları
    this.browseBtn.addEventListener('click', () => this.fileInput.click());
    this.uploadCardZone.addEventListener('click', (e) => {
      if (e.target !== this.browseBtn && !this.browseBtn.contains(e.target)) {
        this.fileInput.click();
      }
    });
    this.replacePhotoBtn.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

    // Geri Dön Butonları (Fotoğraf Seçim Ekranına Geri Dön)
    if (this.navBackBtn) {
      this.navBackBtn.addEventListener('click', () => this.resetToEmptyState());
    }
    if (this.editorBackBtn) {
      this.editorBackBtn.addEventListener('click', () => this.resetToEmptyState());
    }

    // Sürükle ve Bırak Olayları
    this.uploadCardZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.uploadCardZone.classList.add('drag-over');
    });
    this.uploadCardZone.addEventListener('dragleave', () => {
      this.uploadCardZone.classList.remove('drag-over');
    });
    this.uploadCardZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.uploadCardZone.classList.remove('drag-over');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        this.loadFile(e.dataTransfer.files[0]);
      }
    });

    // Hazır Örnek Fotoğraflar
    if (this.sampleIphoneBtn) {
      this.sampleIphoneBtn.addEventListener('click', async () => {
        try {
          IOSToast.show('iPhone 16 Pro örnek fotoğrafı hazırlanıyor...', 'info', 1200);
          const file = await SampleImageService.createSample('iphone');
          await this.loadFile(file);
          this.inputCameraMake.value = 'Apple';
          this.inputCameraModel.value = 'iPhone 16 Pro';
          this.inputLensMake.value = 'Apple';
          this.inputLensModel.value = 'iPhone 16 Pro back camera 24mm f/1.78';
          this.inputMegapixels.value = '48';
          this.inputFocalLength.value = '24';
          this.updateComparison();
          IOSToast.show('iPhone 16 Pro hazır örneği yüklendi ✓', 'success', 2000);
        } catch (err) {
          console.error('iPhone örnek yükleme hatası:', err);
          IOSToast.show(`Örnek yüklenemedi: ${err.message}`, 'error', 3500);
        }
      });
    }

    if (this.sampleSonyBtn) {
      this.sampleSonyBtn.addEventListener('click', async () => {
        try {
          IOSToast.show('Sony α1 II örnek fotoğrafı hazırlanıyor...', 'info', 1200);
          const file = await SampleImageService.createSample('sony');
          await this.loadFile(file);
          this.inputCameraMake.value = 'Sony';
          this.inputCameraModel.value = 'Sony α1 II';
          this.inputLensMake.value = 'Sony';
          this.inputLensModel.value = 'Sony FE 50mm F1.2 GM';
          this.inputMegapixels.value = '50';
          this.inputFocalLength.value = '50';
          this.updateComparison();
          IOSToast.show('Sony α1 II hazır örneği yüklendi ✓', 'success', 2000);
        } catch (err) {
          console.error('Sony örnek yükleme hatası:', err);
          IOSToast.show(`Örnek yüklenemedi: ${err.message}`, 'error', 3500);
        }
      });
    }

    // Tek Tuş Tema Değiştirici
    if (this.themeToggleBtn) {
      this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
    }

    // Canlı Giriş Olayları
    const inputs = [
      this.inputCameraMake,
      this.inputCameraModel,
      this.inputLensModel,
      this.inputLensMake,
      this.inputMegapixels,
      this.inputFocalLength
    ];

    inputs.forEach(input => {
      input.addEventListener('input', () => this.updateComparison());
    });

    // Hazır Seçim Butonları (Preset Chips)
    document.querySelectorAll('.ios-preset-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const targetId = chip.getAttribute('data-target');
        const val = chip.getAttribute('data-val');
        const targetInput = document.getElementById(targetId);
        if (targetInput) {
          targetInput.value = val;
          targetInput.dispatchEvent(new Event('input'));
          // Aktif butonu vurgula
          const container = chip.parentElement;
          container.querySelectorAll('.ios-preset-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');

          // Akıllı Eşleştirme: Model veya Lens seçildiğinde ilgili tüm alanları senkronize et
          if (val === 'Sony α1 II') {
            this.inputCameraMake.value = 'Sony';
            this.inputCameraMake.dispatchEvent(new Event('input'));
            if (!this.inputLensModel.value || this.inputLensModel.value.includes('iPhone')) {
              this.inputLensMake.value = 'Sony';
              this.inputLensModel.value = 'Sony FE 50mm F1.2 GM';
              this.inputFocalLength.value = '50';
              this.inputMegapixels.value = '50';
              this.inputLensMake.dispatchEvent(new Event('input'));
              this.inputLensModel.dispatchEvent(new Event('input'));
              this.inputFocalLength.dispatchEvent(new Event('input'));
              this.inputMegapixels.dispatchEvent(new Event('input'));
            }
          } else if (val === 'iPhone 16 Pro' || val === 'iPhone 17 Pro') {
            this.inputCameraMake.value = 'Apple';
            this.inputCameraMake.dispatchEvent(new Event('input'));
            if (!this.inputLensModel.value || this.inputLensModel.value.includes('Sony')) {
              this.inputLensMake.value = 'Apple';
              this.inputLensModel.value = 'iPhone 16 Pro back camera 24mm f/1.78';
              this.inputFocalLength.value = '24';
              this.inputMegapixels.value = '48';
              this.inputLensMake.dispatchEvent(new Event('input'));
              this.inputLensModel.dispatchEvent(new Event('input'));
              this.inputFocalLength.dispatchEvent(new Event('input'));
              this.inputMegapixels.dispatchEvent(new Event('input'));
            }
          } else if (val === 'Sony FE 50mm F1.2 GM') {
            if (this.inputLensMake) {
              this.inputLensMake.value = 'Sony';
              this.inputLensMake.dispatchEvent(new Event('input'));
            }
            if (this.inputFocalLength && (!this.inputFocalLength.value || this.inputFocalLength.value === '24')) {
              this.inputFocalLength.value = '50';
              this.inputFocalLength.dispatchEvent(new Event('input'));
            }
            if (!this.inputCameraMake.value) {
              this.inputCameraMake.value = 'Sony';
              this.inputCameraMake.dispatchEvent(new Event('input'));
            }
          } else if (val === 'Apple' && (!this.inputCameraModel.value || this.inputCameraModel.value.includes('Sony'))) {
            this.inputCameraModel.value = 'iPhone 16 Pro';
            this.inputCameraModel.dispatchEvent(new Event('input'));
          } else if (val === 'Sony' && (!this.inputCameraModel.value || this.inputCameraModel.value.includes('iPhone'))) {
            this.inputCameraModel.value = 'Sony α1 II';
            this.inputCameraModel.dispatchEvent(new Event('input'));
          }
        }
      });
    });

    // Detaylı EXIF İnceleme Sayfası
    this.inspectExifBtn.addEventListener('click', () => {
      if (this.currentImageInfo) {
        IOSInspector.show(this.currentImageInfo);
      }
    });

    // Kaydet ve İndir Butonu
    this.saveImageBtn.addEventListener('click', () => this.processAndDownload());

    // Marka logosuna tıklandığında (düzenleme modundaysa) fotoğraf seç ekranına geri dön
    const brand = document.querySelector('.ios-nav-brand');
    if (brand) {
      brand.style.cursor = 'pointer';
      brand.addEventListener('click', () => {
        if (this.currentImageInfo) {
          this.resetToEmptyState();
        }
      });
    }

    // Uygulama İçi Galeriye Kaydetme Modalı Olayları
    if (this.saveModalClose) {
      this.saveModalClose.addEventListener('click', () => this.closeSaveModal());
    }
    if (this.saveModalOverlay) {
      this.saveModalOverlay.addEventListener('click', (e) => {
        if (e.target === this.saveModalOverlay) this.closeSaveModal();
      });
    }
    if (this.saveModalShareBtn) {
      this.saveModalShareBtn.addEventListener('click', async () => {
        if (!this.latestSavedBlob) return;
        await this.triggerNativeShare(this.latestSavedBlob, this.latestSavedFilename);
      });
    }
    if (this.saveModalDownloadBtn) {
      this.saveModalDownloadBtn.addEventListener('click', () => {
        if (!this.latestSavedBlob) return;
        this.downloadBlob(this.latestSavedBlob, this.latestSavedFilename);
        IOSToast.show('Dosya indirildi ✓', 'info', 2500);
      });
    }
  }

  resetToEmptyState() {
    this.currentImageInfo = null;
    this.currentProcessedBlob = null;
    this.previewImage.src = '';
    this.emptyStateView.style.display = 'flex';
    this.editorView.style.display = 'none';
    this.bottomActionBar.style.display = 'none';
    if (this.navBackBtn) {
      this.navBackBtn.style.display = 'none';
    }
    if (this.backBar) {
      this.backBar.style.display = 'none';
    }
    document.body.classList.remove('has-editor');
    if (this.appContainer) {
      this.appContainer.classList.remove('has-editor');
    }
    this.fileInput.value = '';
    IOSToast.show('Fotoğraf seç ekranına dönüldü', 'info', 1500);
  }

  /* ========================================================================
     Tema Yönetimi (Tek Tuşla Aydınlık / Karanlık Geçişi)
     ======================================================================== */
  initTheme() {
    const saved = localStorage.getItem('exif-editor-theme');
    const finalTheme = (saved === 'dark') ? 'dark' : 'light';
    this.setTheme(finalTheme, false);
  }

  toggleTheme() {
    const nextTheme = (this.currentTheme === 'dark') ? 'light' : 'dark';
    this.setTheme(nextTheme, true);
  }

  setTheme(theme, showToast = true) {
    const finalTheme = (theme === 'dark') ? 'dark' : 'light';
    this.currentTheme = finalTheme;
    try {
      localStorage.setItem('exif-editor-theme', finalTheme);
    } catch (e) {
      console.warn('localStorage erişim hatası:', e);
    }
    document.documentElement.setAttribute('data-theme', finalTheme);
    document.body.setAttribute('data-theme', finalTheme);

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', finalTheme === 'dark' ? '#121214' : '#F2F2F7');
    }

    if (this.themeToggleBtn) {
      if (finalTheme === 'dark') {
        if (this.themeToggleIcon) this.themeToggleIcon.textContent = '☀️';
        if (this.themeToggleText) this.themeToggleText.textContent = 'Gün Işığı';
        this.themeToggleBtn.setAttribute('title', 'Gün Işığı Moduna Geç');
        this.themeToggleBtn.setAttribute('aria-label', 'Gün Işığı Moduna Geç');
      } else {
        if (this.themeToggleIcon) this.themeToggleIcon.textContent = '🌙';
        if (this.themeToggleText) this.themeToggleText.textContent = 'Alaca';
        this.themeToggleBtn.setAttribute('title', 'Alaca Moduna Geç');
        this.themeToggleBtn.setAttribute('aria-label', 'Alaca Moduna Geç');
      }
    }

    if (showToast) {
      if (finalTheme === 'dark') {
        IOSToast.show('Tema: Alaca', 'info', 1200);
      } else {
        IOSToast.show('Tema: Gün Işığı', 'info', 1200);
      }
    }
  }

  /* ========================================================================
     Dosya Okuma ve Meta Verileri Yükleme
     ======================================================================== */
  handleFileSelect(event) {
    const files = event.target.files;
    if (files && files.length > 0) {
      this.loadFile(files[0]);
    }
  }

  async loadFile(file) {
    try {
      IOSToast.show('Fotoğraf meta verileri okunuyor...', 'info', 1200);

      const info = await ExifReader.parseImage(file);
      this.currentImageInfo = info;

      // Önizlemeyi Güncelle
      this.previewImage.src = info.blobUrl;
      this.previewBadge.textContent = `${info.resolution} · ${info.calculatedMegapixels} MP`;

      // Fotoğraf Bilgileri Kartını Doldur
      this.infoResolution.textContent = info.resolution;
      this.infoMegapixels.textContent = `${info.calculatedMegapixels} MP`;
      this.infoOriginalSize.textContent = info.formattedSize;
      this.infoProcessedSize.textContent = '--';
      this.infoFormat.textContent = info.mimeType;

      // Düzenleme Girişlerini Doldur
      this.inputCameraMake.value = info.make || '';
      this.inputCameraModel.value = info.model || '';
      this.inputLensModel.value = info.lensModel || '';
      this.inputLensMake.value = info.lensMake || info.make || '';
      this.inputMegapixels.value = info.calculatedMegapixels || '';
      this.inputFocalLength.value = info.focalLength || '';

      // Orijinal Karşılaştırma Sütununu Doldur
      this.diffOrigCamera.textContent = info.make || '(Boş)';
      this.diffOrigModel.textContent = info.model || '(Boş)';
      this.diffOrigLens.textContent = info.lensModel || '(Boş)';
      this.diffOrigMp.textContent = info.calculatedMegapixels ? `${info.calculatedMegapixels} MP` : '(Boş)';
      this.diffOrigFl.textContent = info.focalLength ? `${info.focalLength} mm` : '(Boş)';

      // Görünümleri Değiştir & Ekrana sığdırma sınıfı ekle
      this.emptyStateView.style.display = 'none';
      this.editorView.style.display = 'grid';
      this.bottomActionBar.style.display = 'block';
      document.body.classList.add('has-editor');
      if (this.appContainer) {
        this.appContainer.classList.add('has-editor');
      }
      if (this.navBackBtn) {
        this.navBackBtn.style.display = 'inline-flex';
      }
      if (this.backBar) {
        this.backBar.style.display = 'block';
      }

      // Doğrulamayı Sıfırla
      this.resetVerification();

      // Karşılaştırmayı Güncelle
      this.updateComparison();

      IOSToast.show('Fotoğraf başarıyla yüklendi', 'success', 1800);
    } catch (err) {
      console.error('Fotoğraf yüklenemedi:', err);
      IOSToast.show(`Fotoğraf yükleme hatası: ${err.message}`, 'error', 3500);
    }
  }

  /* ========================================================================
     Canlı Karşılaştırma ve Doğrulama Kontrolü
     ======================================================================== */
  updateComparison() {
    if (!this.currentImageInfo) return;

    const make = this.inputCameraMake.value.trim();
    const model = this.inputCameraModel.value.trim();
    const lens = this.inputLensModel.value.trim();
    const mp = this.inputMegapixels.value.trim();
    const fl = this.inputFocalLength.value.trim();

    // Güncel sütununu doldur
    this.diffEditCamera.textContent = make || '(Boş)';
    this.diffEditModel.textContent = model || '(Boş)';
    this.diffEditLens.textContent = lens || '(Boş)';
    this.diffEditMp.textContent = mp ? `${mp} MP` : '(Boş)';
    this.diffEditFl.textContent = fl ? `${fl} mm` : '(Boş)';

    // Fark Vurgulama
    const orig = this.currentImageInfo;
    this.toggleDiffClass(this.diffEditCamera, make !== (orig.make || ''));
    this.toggleDiffClass(this.diffEditModel, model !== (orig.model || ''));
    this.toggleDiffClass(this.diffEditLens, lens !== (orig.lensModel || ''));
    this.toggleDiffClass(this.diffEditMp, parseFloat(mp) !== orig.calculatedMegapixels);
    this.toggleDiffClass(this.diffEditFl, parseFloat(fl) !== (orig.focalLength || null));
  }

  toggleDiffClass(element, isChanged) {
    if (isChanged) {
      element.classList.add('diff-changed');
    } else {
      element.classList.remove('diff-changed');
    }
  }

  resetVerification() {
    this.verificationStatusPill.className = 'ios-badge ios-badge-blue';
    this.verificationStatusPill.textContent = 'Hazır';
    this.verificationList.innerHTML = `
      <div class="verification-item">
        <span class="verification-field-name">Meta verilerin yazılması bekleniyor</span>
        <span class="verification-field-val">Kaydet'e tıklayın</span>
      </div>
    `;
  }

  /* ========================================================================
     Kayıpsız İşleme, Doğrulama ve İndirme
     ======================================================================== */
  async processAndDownload() {
    if (!this.currentImageInfo) return;

    // 1. Doğrulama kontrolleri
    let make = this.inputCameraMake.value.trim();
    let model = this.inputCameraModel.value.trim();
    let lensModel = this.inputLensModel.value.trim();
    let lensMake = this.inputLensMake.value.trim();
    const mpRaw = this.inputMegapixels.value.trim();
    const flRaw = this.inputFocalLength.value.trim();

    // Marka ve Model Otomatik Eşleştirme (Fotoğraf makinesinin telefonda %100 görünmesi için)
    if (!make && model) {
      if (/sony|ilce|α1|a1/i.test(model)) make = 'Sony';
      else if (/iphone|apple/i.test(model)) make = 'Apple';
      else if (/canon/i.test(model)) make = 'Canon';
      else if (/nikon/i.test(model)) make = 'Nikon';
      else if (/fuji/i.test(model)) make = 'Fujifilm';
    }
    if (model && /sony|ilce|α1|a1/i.test(model) && make !== 'Sony') {
      make = 'Sony';
    } else if (model && /iphone/i.test(model) && make !== 'Apple') {
      make = 'Apple';
    }
    if (!lensMake && make) {
      lensMake = make;
    }

    if (mpRaw && (isNaN(parseFloat(mpRaw)) || parseFloat(mpRaw) <= 0)) {
      IOSToast.show('Lütfen geçerli bir Megapiksel sayısı girin (örn. 48)', 'error', 3000);
      this.inputMegapixels.focus();
      return;
    }

    if (flRaw && (isNaN(parseFloat(flRaw)) || parseFloat(flRaw) <= 0)) {
      IOSToast.show('Lütfen mm cinsinden geçerli bir Odak Uzaklığı girin (örn. 24)', 'error', 3000);
      this.inputFocalLength.focus();
      return;
    }

    const metadata = {
      make,
      model,
      lensModel,
      lensMake,
      megapixels: mpRaw ? parseFloat(mpRaw) : null,
      focalLength: flRaw ? parseFloat(flRaw) : null
    };

    // 2. Butonu işleniyor durumuna al
    this.setSaveButtonState('processing');

    try {
      // 3. Kayıpsız meta veri yazımı (Doğrudan ikili segment değişimi)
      const outputBlob = await ExifWriter.applyMetadata(
        this.currentImageInfo.file,
        metadata,
        this.currentImageInfo
      );

      this.currentEditedBlob = outputBlob;

      // İşlenmiş Dosya Boyutunu Güncelle
      this.infoProcessedSize.textContent = formatBytes(outputBlob.size);

      // 4. Doğrulama Kontrolü (Dosyayı geri oku ve test et)
      const report = await MetadataVerifier.verify(
        outputBlob,
        metadata,
        this.currentImageInfo
      );

      // Doğrulama raporunu arayüze bas
      this.renderVerificationReport(report);

      const filename = this.getEditedFilename(this.currentImageInfo.name);

      // 5. Uygulama İçi Galeriye Kaydetme (Tarayıcı indirmesi yerine yerel kaydetme)
      await this.saveToGallery(outputBlob, filename);
      this.setSaveButtonState('saved');
    } catch (err) {
      console.error('Meta veri yazma hatası:', err);
      this.setSaveButtonState('default');
      IOSToast.show(`İşlem başarısız: ${err.message}`, 'error', 4000);
    }
  }

  setSaveButtonState(state) {
    if (state === 'processing') {
      this.saveImageBtn.disabled = true;
      if (this.saveBtnIcon) this.saveBtnIcon.style.display = 'none';
      this.saveBtnSpinner.style.display = 'inline-block';
      this.saveBtnText.textContent = 'İşleniyor ve Doğrulanıyor…';
    } else if (state === 'saved') {
      this.saveImageBtn.disabled = false;
      if (this.saveBtnIcon) this.saveBtnIcon.style.display = 'none';
      this.saveBtnSpinner.style.display = 'none';
      this.saveBtnText.textContent = 'Galeriye Kaydedildi ✓';
      this.saveImageBtn.style.backgroundColor = 'var(--ios-green)';

      setTimeout(() => {
        this.setSaveButtonState('default');
      }, 3000);
    } else {
      this.saveImageBtn.disabled = false;
      if (this.saveBtnIcon) this.saveBtnIcon.style.display = 'inline-flex';
      this.saveBtnSpinner.style.display = 'none';
      this.saveBtnText.textContent = 'Galeriye Kaydet';
      this.saveImageBtn.style.backgroundColor = '';
    }
  }

  renderVerificationReport(report) {
    if (report.success) {
      this.verificationStatusPill.className = 'ios-badge ios-badge-green';
      this.verificationStatusPill.textContent = `Doğrulandı (${report.passedCount}/${report.totalCount})`;
    } else {
      this.verificationStatusPill.className = 'ios-badge ios-badge-orange';
      this.verificationStatusPill.textContent = `Uyarı (${report.passedCount}/${report.totalCount})`;
    }

    let html = '';
    report.checks.forEach(c => {
      const isPassed = c.match;
      html += `
        <div class="verification-item ${isPassed ? 'passed' : 'failed'}">
          <span class="verification-field-name">${c.field}</span>
          <span class="verification-field-val">${isPassed ? '✓ ' : '✕ '}${c.actual}</span>
        </div>
      `;
    });

    this.verificationList.innerHTML = html;
  }

  getEditedFilename(originalName) {
    if (!originalName) return 'fotograf_ATA-EXIF.jpg';
    const lastDot = originalName.lastIndexOf('.');
    if (lastDot === -1) {
      const clean = originalName.replace(/_duzenlendi$/i, '').replace(/[_-]ATA-EXIF$/i, '');
      return `${clean}_ATA-EXIF.jpg`;
    }
    const base = originalName.substring(0, lastDot);
    let ext = originalName.substring(lastDot).toLowerCase();
    // HEIC / HEIF formatı kaydedildiğinde evrensel uyumluluk için .jpg olarak adlandırılır
    if (ext === '.heic' || ext === '.heif') {
      ext = '.jpg';
    }
    const cleanBase = base.replace(/_duzenlendi$/i, '').replace(/[_-]ATA-EXIF$/i, '');
    return `${cleanBase}_ATA-EXIF${ext}`;
  }

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  }

  /**
   * Tarayıcı dosya indirmesi yerine uygulamanın kendi içinde galeriye kaydetme
   */
  async saveToGallery(blob, filename) {
    const fileType = blob.type || 'image/jpeg';
    let file = null;
    try {
      file = new File([blob], filename, { type: fileType });
    } catch (e) {
      console.warn('File constructor desteklenmiyor:', e);
    }

    const canShare = file && navigator.canShare && navigator.canShare({ files: [file] });

    // Mobil cihazda (iOS / Android) Web Share API ile doğrudan sistem "Görüntüyü Kaydet / Galeriye Kaydet"
    if (canShare) {
      try {
        await navigator.share({
          files: [file],
          title: filename,
          text: 'ATA EXIF ile düzenlenen fotoğraf'
        });
        IOSToast.show('Fotoğraf galeriye kaydedildi ✓', 'success', 3500);
        return;
      } catch (err) {
        if (err.name === 'AbortError') {
          // Kullanıcı sistem paylaşım menüsünü kapattıysa alternatif uygulama içi modalı aç
          this.openSaveModal(blob, filename);
          return;
        }
        console.warn('Web Share hatası, uygulama içi modal açılıyor:', err);
      }
    }

    // Web Share desteklenmiyorsa veya masaüstü/tarayıcı kısıtlaması varsa uygulama içi Galeriye Kaydet modalı açılır
    this.openSaveModal(blob, filename);
  }

  openSaveModal(blob, filename) {
    this.latestSavedBlob = blob;
    this.latestSavedFilename = filename;

    if (this.saveModalImage) {
      const url = URL.createObjectURL(blob);
      this.saveModalImage.src = url;
      this.saveModalImage.dataset.blobUrl = url;
    }

    if (this.saveModalOverlay) {
      this.saveModalOverlay.style.display = 'flex';
      requestAnimationFrame(() => {
        this.saveModalOverlay.classList.add('show');
      });
    }
  }

  closeSaveModal() {
    if (this.saveModalOverlay) {
      this.saveModalOverlay.classList.remove('show');
      setTimeout(() => {
        this.saveModalOverlay.style.display = 'none';
        if (this.saveModalImage && this.saveModalImage.dataset.blobUrl) {
          URL.revokeObjectURL(this.saveModalImage.dataset.blobUrl);
          this.saveModalImage.dataset.blobUrl = '';
          this.saveModalImage.src = '';
        }
      }, 300);
    }
  }

  async triggerNativeShare(blob, filename) {
    const fileType = blob.type || 'image/jpeg';
    let file = null;
    try {
      file = new File([blob], filename, { type: fileType });
    } catch (e) {
      console.warn('File constructor hatası:', e);
    }

    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: filename,
          text: 'ATA EXIF ile düzenlenen fotoğraf'
        });
        IOSToast.show('Fotoğraf galeriye kaydedildi ✓', 'success', 3000);
        this.closeSaveModal();
        return true;
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Paylaşım hatası:', err);
          IOSToast.show('Galeriye doğrudan aktarılamadı, lütfen fotoğrafa basılı tutun.', 'info', 4000);
        }
        return false;
      }
    } else {
      IOSToast.show('Bu cihazda doğrudan galeri paylaşımı desteklenmiyor. Lütfen fotoğrafa basılı tutarak kaydedin.', 'info', 4000);
      return false;
    }
  }
}

// DOM Hazır Olduğunda Başlat
document.addEventListener('DOMContentLoaded', () => {
  new AppController();
});
