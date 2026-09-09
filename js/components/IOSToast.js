/**
 * IOSToast.js
 * 
 * Dynamic Island stili ince, zarif ve tek satırlı yüzen bildirim kapsülü.
 */

export class IOSToast {
  static show(message, type = 'success', duration = 3000, customIcon = null) {
    const container = document.getElementById('ios-toast-container');
    const toast = document.getElementById('ios-toast');
    const icon = document.getElementById('ios-toast-icon');
    const text = document.getElementById('ios-toast-text');

    if (!container || !toast || !icon || !text) return;

    // Sınıfları sıfırla
    toast.className = 'ios-toast';
    if (customIcon) {
      toast.classList.add('ios-toast-info');
      icon.innerHTML = customIcon;
    } else if (type === 'success') {
      toast.classList.add('ios-toast-success');
      icon.innerHTML = '✓';
    } else if (type === 'error') {
      toast.classList.add('ios-toast-error');
      icon.innerHTML = '✕';
    } else {
      toast.classList.add('ios-toast-info');
      icon.innerHTML = '<span class="toast-info-i">i</span>';
    }

    text.className = 'ios-toast-text';
    text.textContent = message;
    container.classList.add('show');

    if (this._timeout) clearTimeout(this._timeout);
    this._timeout = setTimeout(() => {
      container.classList.remove('show');
    }, duration);
  }
}
