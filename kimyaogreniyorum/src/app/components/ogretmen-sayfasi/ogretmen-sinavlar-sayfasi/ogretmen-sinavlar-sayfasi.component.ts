import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CevapAnahtari } from '../modeller/cevap-anahtari';


@Component({
  selector: 'app-ogretmen-sinavlar-sayfasi',
  standalone: false,
  templateUrl: './ogretmen-sinavlar-sayfasi.component.html',
  styleUrl: './ogretmen-sinavlar-sayfasi.component.scss',
})
export class OgretmenSinavlarSayfasiComponent implements OnInit {
  cevap: any;
  resetForm() {
    throw new Error('Method not implemented.');
  }
  cevapAnahtari: CevapAnahtari = new CevapAnahtari();
  imagePreview: string | null = null;
  submitting = false;
  successMessage = '';
  errorMessage = '';
  cevapAnahtarlari: CevapAnahtari[] = [];
  loading = true;
  maxSoruSayisi = 100;

  sinavTurleri = [
    { id: 'TYT', label: 'TYT Deneme' },
    { id: 'AYT', label: 'AYT Deneme' },
    { id: 'TAR', label: 'Tarama Sınavı' },
    { id: 'TEST', label: 'Konu Testi' },
  ];
  // Soruları kolay yönetmek için dizi
  sorular: number[] = [];
  cevapForm!: FormGroup<any>;
  constructor(private http: HttpClient) {}
  ngOnInit() {
    this.initModel();
    this.loadCevapAnahtarlari();

    this.initForm();
    this.loadCevapAnahtarlari();

    // ESC tuşu ile modalı kapatma
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.editMode) {
        this.cancelEdit();
      }
    });
  }
  initForm() {
    throw new Error('Method not implemented.');
  }
  initModel() {
    const today = new Date();
    this.cevapAnahtari = new CevapAnahtari({
      sinav_adi: '',
      sinav_turu: '',
      soru_sayisi: 30,
      tarih: this.formatDate(today),
      sinav_kapagi: '',
      cevaplar: {},
      konular: {},
      videolar: {},
    });

    // Varsayılan 20 soru için soruları güncelle
    this.updateSorular(7);
  }
  updateSorular(count: number) {
    this.cevapAnahtari.soru_sayisi = count;
    this.sorular = Array(count)
      .fill(0)
      .map((_, i) => i + 1);

    // Her soru için boş varsayılan değerler oluştur
    for (let i = 1; i <= count; i++) {
      if (!this.cevapAnahtari.cevaplar[`ca${i}`]) {
        this.cevapAnahtari.cevaplar[`ca${i}`] = '';
      }
      if (!this.cevapAnahtari.konular[`ka${i}`]) {
        this.cevapAnahtari.konular[`ka${i}`] = '';
      }
      if (!this.cevapAnahtari.videolar[`va${i}`]) {
        this.cevapAnahtari.videolar[`va${i}`] = '';
      }
    }
  }
  onImageSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      // Dosya seçildiğinde önizleme göster
      const reader = new FileReader();
      reader.onload = () => {
        this.imagePreview = reader.result as string;
      };
      reader.readAsDataURL(file);
      // Dosyayı formun değerine ata
      this.cevapAnahtari.sinav_kapagi = file.name;
    }
  }
  submitForm() {
    // Veri doğrulama
    if (
      !this.cevapAnahtari.sinav_adi ||
      !this.cevapAnahtari.sinav_turu ||
      this.cevapAnahtari.soru_sayisi <= 0 ||
      !this.cevapAnahtari.tarih
    ) {
      this.showError('Lütfen zorunlu alanları doldurun.');
      return;
    }

    // Cevapları doğrula
    let cevaplarinTamamiVar = true;
    for (let i = 1; i <= this.cevapAnahtari.soru_sayisi; i++) {
      if (!this.cevapAnahtari.cevaplar[`ca${i}`]) {
        cevaplarinTamamiVar = false;
        break;
      }
    }

    if (!cevaplarinTamamiVar) {
      this.showError('Lütfen tüm soruların cevaplarını girin.');
      return;
    }
    this.submitting = true;
    this.successMessage = '';
    this.errorMessage = '';
    // Form verilerini FormData nesnesine dönüştür
    const formData = new FormData();

    // Ana form değerlerini FormData'ya ekle
    formData.append('sinav_adi', this.cevapAnahtari.sinav_adi);
    formData.append('sinav_turu', this.cevapAnahtari.sinav_turu);
    formData.append('soru_sayisi', this.cevapAnahtari.soru_sayisi.toString());
    formData.append('tarih', this.cevapAnahtari.tarih);

    // JSON verilerini ekle
    formData.append('cevaplar', JSON.stringify(this.cevapAnahtari.cevaplar));
    formData.append('konular', JSON.stringify(this.cevapAnahtari.konular));
    formData.append('videolar', JSON.stringify(this.cevapAnahtari.videolar));

    // Dosya ekle
    const fileInput = document.getElementById(
      'sinav_kapagi'
    ) as HTMLInputElement;
    if (fileInput.files && fileInput.files.length > 0) {
      formData.append('sinav_kapagi', fileInput.files[0]);
    }
    // API'ye gönder
    this.http
      .post(`./server/api/cevap-anahtari-ekle.php`,
        formData
      )
      .subscribe(
        (response: any) => {
          this.submitting = false;
          if ((response as { success: boolean; data: any[] }).success) {
            this.showSuccess('Cevap anahtarı başarıyla kaydedildi.');
            this.initModel();
            this.imagePreview = null;
            // Dosya input'unu temizle
            if (fileInput) fileInput.value = '';
            this.loadCevapAnahtarlari(); // Listeyi yenile
          } else {
            this.showError(response.message || 'Bir hata oluştu.');
          }
        },
        (error) => {
          this.submitting = false;
          this.showError(
            'Sunucu hatası: ' + (error.message || 'Bilinmeyen bir hata oluştu.')
          );
        }
      );
  }
  loadCevapAnahtarlari() {
    this.loading = true;
    this.http.get(`./server/api/cevap-anahtarlari-listele.php`).subscribe(
      (response: any) => {
        this.loading = false;
        if (response.success) {
          this.cevapAnahtarlari = response.data.map((item: any) =>
            CevapAnahtari.fromJson(item)
          );
        } else {
          this.showError('Cevap anahtarları yüklenirken bir hata oluştu.');
        }
      },
      (error) => {
        this.loading = false;
        this.showError(
          'Sunucu hatası: ' + (error.message || 'Bilinmeyen bir hata oluştu.')
        );
      }
    );
  }
  getSoruDizisi(cevap: any): number[] {
    // Eğer cevap.soru_sayisi varsa ve sayısal bir değerse, o sayıyı kullan
    if (cevap.soru_sayisi && !isNaN(Number(cevap.soru_sayisi))) {
      console.log('Soru sayısı:', cevap.soru_sayisi); // Debug için
      return Array(Number(cevap.soru_sayisi))
        .fill(0)
        .map((_, i) => i);
    }

    // Eğer cevap.soru_sayisi yoksa veya sayısal değilse, cevaplar nesnesinin anahtarlarına bak
    if (cevap.cevaplar) {
      console.log('Cevaplar:', cevap.cevaplar); // Debug için
      // ca1, ca2, ca3 gibi anahtarları bul ve en büyük sayıyı tespit et
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

      return Array(maxIndex)
        .fill(0)
        .map((_, i) => i);
    }

    // Hiçbir veri bulunamadıysa boş dizi döndür
    return [];
  }
  // Düzenleme modu için eklenecek değişkenler
  editMode = false;
  currentEditingCevapAnahtari: any = null;

  // Düzenleme modunu açma metodu
  editCevapAnahtari(cevap: any) {
    this.editMode = true;
    // Derin kopya oluştur, böylece orijinal veriyi bozmayız
    this.currentEditingCevapAnahtari = JSON.parse(JSON.stringify(cevap));

    // Kapak resim önizlemesi için URL oluştur
    if (this.currentEditingCevapAnahtari.sinav_kapagi) {
      this.imagePreview =
        '/uploads/' + this.currentEditingCevapAnahtari.sinav_kapagi;
    } else {
      this.imagePreview = null;
    }

    // Modal açıldığında scroll'u engelle
    document.body.style.overflow = 'hidden';
  }

  // Düzenleme modunu iptal etme metodu
  cancelEdit() {
    this.editMode = false;
    this.currentEditingCevapAnahtari = null;
    this.imagePreview = null;

    // Scroll'u geri etkinleştir
    document.body.style.overflow = '';
  }

  // Düzenleme formunu gönderme
  submitEditForm() {
    if (
      !this.currentEditingCevapAnahtari ||
      !this.currentEditingCevapAnahtari.id
    ) {
      this.showError('Düzenlenecek kayıt bulunamadı.');
      return;
    }

    // Veri doğrulama
    if (
      !this.currentEditingCevapAnahtari.sinav_adi ||
      !this.currentEditingCevapAnahtari.sinav_turu ||
      this.currentEditingCevapAnahtari.soru_sayisi <= 0 ||
      !this.currentEditingCevapAnahtari.tarih
    ) {
      this.showError('Lütfen tüm zorunlu alanları doldurun.');
      return;
    }

    this.submitting = true;
    this.successMessage = '';
    this.errorMessage = '';

    // FormData nesnesi oluştur
    const formData = new FormData();
    formData.append('id', this.currentEditingCevapAnahtari.id);
    formData.append('sinav_adi', this.currentEditingCevapAnahtari.sinav_adi);
    formData.append('sinav_turu', this.currentEditingCevapAnahtari.sinav_turu);
    formData.append(
      'soru_sayisi',
      this.currentEditingCevapAnahtari.soru_sayisi.toString()
    );
    formData.append('tarih', this.currentEditingCevapAnahtari.tarih);
    formData.append(
      'cevaplar',
      JSON.stringify(this.currentEditingCevapAnahtari.cevaplar)
    );
    formData.append(
      'konular',
      JSON.stringify(this.currentEditingCevapAnahtari.konular)
    );
    formData.append(
      'videolar',
      JSON.stringify(this.currentEditingCevapAnahtari.videolar)
    );

    // Dosya ekle (eğer varsa)
    const fileInput = document.getElementById(
      'edit_sinav_kapagi'
    ) as HTMLInputElement;
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
      formData.append('sinav_kapagi', fileInput.files[0]);
    }

    // API'ye gönder
    this.http
      .post(`./server/api/cevap-anahtari-guncelle.php`, formData)
      .subscribe(
        (response: any) => {
          this.submitting = false;
          if (response.success) {
            this.showSuccess('Cevap anahtarı başarıyla güncellendi.');
            this.editMode = false;
            this.currentEditingCevapAnahtari = null;
            this.imagePreview = null;
            this.loadCevapAnahtarlari(); // Listeyi yenile

            // Scroll'u geri etkinleştir
            document.body.style.overflow = '';
          } else {
            this.showError(response.message || 'Bir hata oluştu.');
          }
        },
        (error) => {
          this.submitting = false;
          console.error('Güncelleme hatası:', error);
          this.showError(
            'Sunucu hatası: ' + (error.message || 'Bilinmeyen bir hata oluştu.')
          );
        }
      );
  }

  // Klavye kısayolları için listener ekleyelim

  // Component yok edildiğinde temizlik yap
  ngOnDestroy() {
    // Bellek sızıntısı olmaması için event listener'ı temizle
    document.removeEventListener('keydown', () => {});

    // Scroll'u geri etkinleştir
    document.body.style.overflow = '';
  }
  deleteCevapAnahtari(id: number) {
    if (confirm('Bu cevap anahtarını silmek istediğinize emin misiniz?')) {
      this.http
        .post(
          `./server/api/cevap-anahtari-sil.php`,
          { id }
        )
        .subscribe(
          (response: any) => {
            if (response.success) {
              this.showSuccess('Cevap anahtarı başarıyla silindi.');
              this.loadCevapAnahtarlari(); // Listeyi yenile
            } else {
              this.showError(response.message || 'Silme işlemi başarısız.');
            }
          },
          (error) => {
            this.showError(
              'Sunucu hatası: ' +
                (error.message || 'Bilinmeyen bir hata oluştu.')
            );
          }
        );
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
    setTimeout(() => (this.successMessage = ''), 5000); // 5 saniye sonra mesajı kaldır
  }
  showError(message: string) {
    this.errorMessage = message;
    setTimeout(() => (this.errorMessage = ''), 5000); // 5 saniye sonra mesajı kaldır
  }
  trackByFn(index: number, item: any) {
    return index;
  }
}
