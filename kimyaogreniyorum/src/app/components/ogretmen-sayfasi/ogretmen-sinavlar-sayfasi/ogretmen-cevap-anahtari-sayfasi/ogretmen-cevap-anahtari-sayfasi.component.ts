import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit, OnDestroy } from '@angular/core';

interface CevapAnahtariInterface {
  id?: number;
  sinav_adi: string;
  sinav_turu: string;
  soru_sayisi: number;
  tarih: string;
  sinav_kapagi?: string;
  cevaplar: { [key: string]: string };
  konular?: { [key: string]: string };
  videolar?: { [key: string]: string };
  aktiflik: boolean;
  created_at?: string;
}

@Component({
  selector: 'app-ogretmen-cevap-anahtari-sayfasi',
  standalone: false,
  templateUrl: './ogretmen-cevap-anahtari-sayfasi.component.html',
  styleUrl: './ogretmen-cevap-anahtari-sayfasi.component.scss',
})
export class OgretmenCevapAnahtariSayfasiComponent implements OnInit, OnDestroy {
  // Ana cevap anahtarı verisi
  cevapAnahtari: CevapAnahtariInterface = {
    sinav_adi: '',
    sinav_turu: '',
    soru_sayisi: 50,
    tarih: this.formatDate(new Date()),
    cevaplar: {},
    konular: {},
    videolar: {},
    aktiflik: true
  };

  // UI durumları
  imagePreview: string | null = null;
  submitting = false;
  successMessage = '';
  errorMessage = '';
  loading = true;
  maxSoruSayisi = 100;
  searchQuery = '';
  showAddForm = false;
  error: string | null = null;

  // Liste verileri
  cevapAnahtarlari: CevapAnahtariInterface[] = [];

  // Düzenleme modu
  isEditing = false;
  showModal = false;
  currentEditingCevapAnahtari: CevapAnahtariInterface | null = null;

  sinavTurleri = [
    { id: 'TYT', label: 'TYT Deneme' },
    { id: 'AYT', label: 'AYT Deneme' },
    { id: 'TAR', label: 'Tarama Sınavı' },
    { id: 'TEST', label: 'Konu Testi' },
  ];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadCevapAnahtarlari();
    this.initializeCevaplar();
  }

  ngOnDestroy() {
    document.body.style.overflow = '';
  }

  // Auth headers
  private getAuthHeaders(): HttpHeaders {
    let token = '';
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      token = user.token || '';
    }
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  // Cevap anahtarlarını yükle
  loadCevapAnahtarlari() {
    this.loading = true;
    const headers = this.getAuthHeaders();

    console.log('API çağrısı yapılıyor: cevap-anahtarlari-listele.php');

    this.http.get<any>('./server/api/cevap-anahtarlari-listele.php', { headers }).subscribe({
      next: (response: any) => {
        console.log('API yanıtı:', response);
        this.loading = false;
        if (response.success) {
          this.cevapAnahtarlari = (response.data || []).map((item: any) => {
            try {
              if (typeof item.cevaplar === 'string') {
                item.cevaplar = JSON.parse(item.cevaplar);
              }
              if (typeof item.konular === 'string') {
                item.konular = JSON.parse(item.konular);
              }
              if (typeof item.videolar === 'string') {
                item.videolar = JSON.parse(item.videolar);
              }
            } catch (parseError) {
              console.error('JSON parse hatası:', parseError, item);
              if (typeof item.cevaplar === 'string') item.cevaplar = {};
              if (typeof item.konular === 'string') item.konular = {};
              if (typeof item.videolar === 'string') item.videolar = {};
            }
            return item;
          });
          console.log('Yüklenen cevap anahtarları sayısı:', this.cevapAnahtarlari.length);
        } else {
          console.error('API hatası:', response);
          this.cevapAnahtarlari = [];
          this.error = response.error || response.message || 'Bilinmeyen hata';
          this.showError('Cevap anahtarları yüklenirken bir hata oluştu: ' + this.error);
        }
      },
      error: (error) => {
        console.error('HTTP hatası detayı:', error);
        this.loading = false;
        this.cevapAnahtarlari = [];
        this.error = error.error?.error || error.error?.message || error.message || 'Bağlantı hatası';
        this.showError('Sunucu hatası: ' + this.error);
      },
    });
  }

  // Cevapları başlat
  initializeCevaplar() {
    this.cevapAnahtari.cevaplar = {};
    this.cevapAnahtari.konular = {};
    this.cevapAnahtari.videolar = {};

    for (let i = 1; i <= this.cevapAnahtari.soru_sayisi; i++) {
      this.cevapAnahtari.cevaplar[`ca${i}`] = '';
      this.cevapAnahtari.konular[`ka${i}`] = '';
      this.cevapAnahtari.videolar[`va${i}`] = '';
    }
  }

  // Soru sayısı değiştiğinde
  onSoruSayisiChange() {
    this.initializeCevaplar();
  }

  // Soru dizisini al
  getSoruDizisi(cevap: any): number[] {
    if (cevap.soru_sayisi && !isNaN(Number(cevap.soru_sayisi))) {
      return Array(Number(cevap.soru_sayisi))
        .fill(0)
        .map((_, i) => i + 1);
    }

    if (cevap.cevaplar) {
      const keys = Object.keys(cevap.cevaplar);
      let maxIndex = 0;

      for (const key of keys) {
        if (key.startsWith('ca')) {
          const index = parseInt(key.substring(2));
          if (!isNaN(index) && index > maxIndex) {
            maxIndex = index;
          }
        }
      }
      return Array(maxIndex).fill(0).map((_, i) => i + 1);
    }

    return [];
  }

  // Form gönderme
  onSubmit() {
    if (this.submitting) return;

    if (!this.cevapAnahtari.sinav_adi.trim()) {
      this.showError('Sınav adı gereklidir.');
      return;
    }

    if (!this.cevapAnahtari.sinav_turu) {
      this.showError('Sınav türü seçilmelidir.');
      return;
    }

    if (this.cevapAnahtari.soru_sayisi <= 0) {
      this.showError('Soru sayısı 0\'dan büyük olmalıdır.');
      return;
    }

    this.submitting = true;

    const formData = new FormData();
    formData.append('sinav_adi', this.cevapAnahtari.sinav_adi);
    formData.append('sinav_turu', this.cevapAnahtari.sinav_turu);
    formData.append('soru_sayisi', this.cevapAnahtari.soru_sayisi.toString());
    formData.append('tarih', this.cevapAnahtari.tarih);
    formData.append('cevaplar', JSON.stringify(this.cevapAnahtari.cevaplar));
    formData.append('konular', JSON.stringify(this.cevapAnahtari.konular || {}));
    formData.append('videolar', JSON.stringify(this.cevapAnahtari.videolar || {}));
    formData.append('aktiflik', this.cevapAnahtari.aktiflik ? '1' : '0');

    const fileInput = document.getElementById('sinav_kapagi') as HTMLInputElement;
    if (fileInput?.files && fileInput.files.length > 0) {
      formData.append('sinav_kapagi', fileInput.files[0]);
    }

    this.http.post(`./server/api/cevap-anahtari-ekle.php`, formData).subscribe(
      (response: any) => {
        this.submitting = false;
        if (response.success) {
          this.showSuccess('Cevap anahtarı başarıyla kaydedildi.');
          this.resetForm();
          this.loadCevapAnahtarlari();
        } else {
          this.showError(response.message || 'Bir hata oluştu.');
        }
      },
      (error) => {
        this.submitting = false;
        this.showError('Sunucu hatası: ' + (error.message || 'Bilinmeyen bir hata oluştu.'));
      }
    );
  }

  // Formu sıfırla
  resetForm() {
    this.cevapAnahtari = {
      sinav_adi: '',
      sinav_turu: '',
      soru_sayisi: 50,
      tarih: this.formatDate(new Date()),
      cevaplar: {},
      konular: {},
      videolar: {},
      aktiflik: true
    };
    this.initializeCevaplar();
    this.imagePreview = null;

    const fileInput = document.getElementById('sinav_kapagi') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }

  // Düzenleme modunu aç
  editCevapAnahtari(cevapAnahtari: CevapAnahtariInterface): void {
    this.currentEditingCevapAnahtari = {
      ...cevapAnahtari,
      cevaplar: { ...(cevapAnahtari.cevaplar || {}) },
      konular: { ...(cevapAnahtari.konular || {}) },
      videolar: { ...(cevapAnahtari.videolar || {}) }
    };

    // Eksik cevapları, konuları ve videoları ekle
    for (let i = 1; i <= this.currentEditingCevapAnahtari.soru_sayisi; i++) {
      if (!this.currentEditingCevapAnahtari.cevaplar[`ca${i}`]) {
        this.currentEditingCevapAnahtari.cevaplar[`ca${i}`] = '';
      }
      if (!this.currentEditingCevapAnahtari.konular![`ka${i}`]) {
        this.currentEditingCevapAnahtari.konular![`ka${i}`] = '';
      }
      if (!this.currentEditingCevapAnahtari.videolar![`va${i}`]) {
        this.currentEditingCevapAnahtari.videolar![`va${i}`] = '';
      }
    }

    this.isEditing = true;
    this.showModal = true;
    document.body.style.overflow = 'hidden';
  }

  // Düzenleme modunu kapat
  closeEditModal(): void {
    this.isEditing = false;
    this.showModal = false;
    this.currentEditingCevapAnahtari = null;
    document.body.style.overflow = '';
  }

  // Güncelleme
  updateCevapAnahtari(): void {
    if (!this.currentEditingCevapAnahtari) return;

    if (!this.currentEditingCevapAnahtari.sinav_adi.trim()) {
      this.showError('Sınav adı gereklidir.');
      return;
    }

    const data = {
      id: this.currentEditingCevapAnahtari.id,
      sinav_adi: this.currentEditingCevapAnahtari.sinav_adi,
      sinav_turu: this.currentEditingCevapAnahtari.sinav_turu,
      soru_sayisi: this.currentEditingCevapAnahtari.soru_sayisi,
      tarih: this.currentEditingCevapAnahtari.tarih,
      cevaplar: JSON.stringify(this.currentEditingCevapAnahtari.cevaplar),
      konular: JSON.stringify(this.currentEditingCevapAnahtari.konular || {}),
      videolar: JSON.stringify(this.currentEditingCevapAnahtari.videolar || {}),
      aktiflik: this.currentEditingCevapAnahtari.aktiflik
    };

    this.http.post('./server/api/cevap-anahtari-guncelle.php', data, {
      headers: { 'Content-Type': 'application/json' }
    }).subscribe(
      (response: any) => {
        if (response.success) {
          this.showSuccess('Cevap anahtarı başarıyla güncellendi.');
          this.closeEditModal();
          this.loadCevapAnahtarlari();
        } else {
          this.showError(response.message || 'Güncelleme başarısız.');
        }
      },
      (error) => {
        this.showError('Sunucu hatası: ' + (error.message || 'Bilinmeyen bir hata oluştu.'));
      }
    );
  }

  // Silme
  deleteCevapAnahtari(id: number) {
    if (confirm('Bu cevap anahtarını silmek istediğinize emin misiniz?')) {
      this.http.post(`./server/api/cevap-anahtari-sil.php`, { id }).subscribe(
        (response: any) => {
          if (response.success) {
            this.showSuccess('Cevap anahtarı başarıyla silindi.');
            this.loadCevapAnahtarlari();
          } else {
            this.showError(response.message || 'Silme işlemi başarısız.');
          }
        },
        (error) => {
          this.showError('Sunucu hatası: ' + (error.message || 'Bilinmeyen bir hata oluştu.'));
        }
      );
    }
  }

  // Resim önizleme
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imagePreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  // Yardımcı metodlar
  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getSinavTuruLabel(id: string): string {
    const tur = this.sinavTurleri.find((t) => t.id === id);
    return tur ? tur.label : id;
  }

  showSuccess(message: string) {
    this.successMessage = message;
    setTimeout(() => (this.successMessage = ''), 5000);
  }

  showError(message: string) {
    this.errorMessage = message;
    setTimeout(() => (this.errorMessage = ''), 5000);
  }

  trackByFn(index: number, item: any) {
    return index;
  }

  // Filtreleme
  get filteredCevapAnahtarlari(): CevapAnahtariInterface[] {
    if (!this.searchQuery.trim()) {
      return this.cevapAnahtarlari;
    }

    const query = this.searchQuery.toLowerCase().trim();
    return this.cevapAnahtarlari.filter(
      (cevap) =>
        cevap.sinav_adi.toLowerCase().includes(query) ||
        this.getSinavTuruLabel(cevap.sinav_turu).toLowerCase().includes(query)
    );
  }

  // İstatistikler
  getActiveSinavCount(): number {
    const today = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(today.getMonth() - 1);

    return this.cevapAnahtarlari.filter((cevap) => {
      const cevapDate = new Date(cevap.tarih);
      return cevapDate >= oneMonthAgo;
    }).length;
  }

  getThisMonthCount(): number {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    return this.cevapAnahtarlari.filter((cevap) => {
      const cevapDate = new Date(cevap.tarih);
      return cevapDate >= firstDayOfMonth;
    }).length;
  }
}