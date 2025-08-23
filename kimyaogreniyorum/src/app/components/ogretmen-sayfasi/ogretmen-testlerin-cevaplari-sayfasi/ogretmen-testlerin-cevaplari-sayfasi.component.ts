import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CevapAnahtari } from '../modeller/cevap-anahtari';

@Component({
  selector: 'app-ogretmen-testlerin-cevaplari-sayfasi',
  standalone: false,
  templateUrl: './ogretmen-testlerin-cevaplari-sayfasi.component.html',
  styleUrl: './ogretmen-testlerin-cevaplari-sayfasi.component.scss'
})
export class OgretmenTestlerinCevaplariSayfasiComponent implements OnInit {
  cevapAnahtarlari: CevapAnahtari[] = [];
  showAddModal = false;
  showEditModal = false;
  currentEditingCevapAnahtari: CevapAnahtari | null = null;
  newCevapAnahtari: CevapAnahtari = new CevapAnahtari();
  successMessage = '';
  errorMessage = '';
  loading = false;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadCevapAnahtarlari();
  }

  loadCevapAnahtarlari() {
    this.loading = true;
    this.http.get<any>('server/api/test-cevap-anahtarlari-listele.php').subscribe({
      next: (response) => {
        if (response.success) {
          this.cevapAnahtarlari = response.data.map((item: any) => CevapAnahtari.fromJson(item));
        } else {
          this.showError('Test cevap anahtarları yüklenemedi: ' + response.message);
        }
        this.loading = false;
      },
      error: (error) => {
        this.showError('Veri yükleme hatası: ' + error.message);
        this.loading = false;
      }
    });
  }

  showAddModalPanel() {
    this.newCevapAnahtari = new CevapAnahtari();
    this.showAddModal = true;
  }

  closeAddModal() {
    this.showAddModal = false;
    this.newCevapAnahtari = new CevapAnahtari();
  }

  showEditModalPanel(cevapAnahtari: CevapAnahtari) {
    // If you want to clone, use fromJson to preserve methods
    this.currentEditingCevapAnahtari = CevapAnahtari.fromJson(cevapAnahtari);
    this.showEditModal = true;
  }

  closeEditModal() {
    this.showEditModal = false;
    this.currentEditingCevapAnahtari = null;
  }

  saveCevapAnahtari(): void {
    if (!this.newCevapAnahtari.test_adi || !this.newCevapAnahtari.test_turu ||
        !this.newCevapAnahtari.soru_sayisi || !this.newCevapAnahtari.tarih) {
      this.errorMessage = 'Lütfen tüm zorunlu alanları doldurunuz.';
      return;
    }

    // Validate answers
    const hasAnswers = Object.values(this.newCevapAnahtari.cevaplar).some(answer => answer.trim() !== '');
    if (!hasAnswers) {
      this.errorMessage = 'En az bir cevap girmelisiniz.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    // Prepare form data for API
    const formData = new FormData();
    formData.append('test_adi', this.newCevapAnahtari.test_adi);
    formData.append('test_turu', this.newCevapAnahtari.test_turu);
    formData.append('soru_sayisi', this.newCevapAnahtari.soru_sayisi.toString());
    formData.append('tarih', this.newCevapAnahtari.tarih);
    formData.append('cevaplar', JSON.stringify(this.newCevapAnahtari.cevaplar));
    formData.append('konular', JSON.stringify({}));
    formData.append('videolar', JSON.stringify({}));
    formData.append('aktiflik', 'true');

    // API call to save test answer key
    fetch('server/api/test-cevap-anahtari-ekle.php', {
      method: 'POST',
      body: formData
    })
    .then(response => response.json())
    .then(data => {
      this.loading = false;
      if (data.success) {
        this.successMessage = data.message || 'Cevap anahtarı başarıyla kaydedildi.';
        this.loadCevapAnahtarlari(); // Reload the list
        this.closeAddModal();
      } else {
        this.errorMessage = data.message || 'Kaydetme işlemi başarısız oldu.';
      }
    })
    .catch(error => {
      this.loading = false;
      console.error('API Error:', error);
      this.errorMessage = 'Kaydetme sırasında bir hata oluştu.';
    });
  }

  updateCevapAnahtari() {
    if (!this.currentEditingCevapAnahtari || !this.validateCevapAnahtari(this.currentEditingCevapAnahtari)) {
      return;
    }

    const data = this.currentEditingCevapAnahtari.toJson();

    this.http.post<any>('server/api/test-cevap-anahtari-guncelle.php', data).subscribe({
      next: (response) => {
        if (response.success) {
          this.showSuccess('Cevap anahtarı başarıyla güncellendi');
          this.closeEditModal();
          this.loadCevapAnahtarlari();
        } else {
          this.showError('Güncelleme hatası: ' + response.message);
        }
      },
      error: (error) => {
        this.showError('Güncelleme hatası: ' + error.message);
      }
    });
  }

  deleteCevapAnahtari(id: number) {
    if (confirm('Bu cevap anahtarını silmek istediğinizden emin misiniz?')) {
      this.http.post<any>('server/api/test-cevap-anahtari-sil.php', { id }).subscribe({
        next: (response) => {
          if (response.success) {
            this.showSuccess('Cevap anahtarı başarıyla silindi');
            this.loadCevapAnahtarlari();
          } else {
            this.showError('Silme hatası: ' + response.message);
          }
        },
        error: (error) => {
          this.showError('Silme hatası: ' + error.message);
        }
      });
    }
  }

  validateCevapAnahtari(cevapAnahtari: CevapAnahtari): boolean {
    if (!cevapAnahtari.test_adi.trim()) {
      this.showError('Test adı gereklidir');
      return false;
    }
    if (!cevapAnahtari.test_turu) {
      this.showError('Test türü seçilmelidir');
      return false;
    }
    if (cevapAnahtari.soru_sayisi <= 0) {
      this.showError('Soru sayısı 0\'dan büyük olmalıdır');
      return false;
    }
    if (!cevapAnahtari.tarih) {
      this.showError('Tarih seçilmelidir');
      return false;
    }
    return true;
  }

  initializeCevaplar(soruSayisi: number) {
    const cevaplar: { [key: string]: string } = {};
    for (let i = 1; i <= soruSayisi; i++) {
      cevaplar[`ca${i}`] = '';
    }
    return cevaplar;
  }

  onSoruSayisiChange(cevapAnahtari: CevapAnahtari) {
    cevapAnahtari.cevaplar = this.initializeCevaplar(cevapAnahtari.soru_sayisi);
  }

  getSoruDizisi(cevapAnahtari: CevapAnahtari): number[] {
    return Array.from({ length: cevapAnahtari.soru_sayisi }, (_, i) => i);
  }

  // Cevapları 10'ar 10'ar gruplandırma
  getAnswerGroups(cevapAnahtari: CevapAnahtari): Array<{start: number, end: number, answers: Array<{soru: number, cevap: string}>}> {
    const groups = [];
    const soruSayisi = cevapAnahtari.soru_sayisi;

    for (let i = 0; i < soruSayisi; i += 10) {
      const start = i + 1;
      const end = Math.min(i + 10, soruSayisi);
      const answers = [];

      for (let j = start; j <= end; j++) {
        const cevap = cevapAnahtari.cevaplar[`ca${j}`] || '';
        answers.push({ soru: j, cevap });
      }

      groups.push({ start, end, answers });
    }

    return groups;
  }

  getSinavTuruLabel(turu: string): string {
    const labels: { [key: string]: string } = {
      'deneme': 'Deneme Sınavı',
      'yazili': 'Yazılı Sınavı',
      'quiz': 'Quiz',
      'tarama': 'Tarama Testi',
      'konu_testi': 'Konu Testi'
    };
    return labels[turu] || turu;
  }

  showSuccess(message: string) {
    this.successMessage = message;
    setTimeout(() => this.successMessage = '', 5000);
  }

  showError(message: string) {
    this.errorMessage = message;
    setTimeout(() => this.errorMessage = '', 5000);
  }
}