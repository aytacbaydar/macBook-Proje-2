import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CevapAnahtari } from '../../modeller/cevap-anahtari';


@Component({
  selector: 'app-ogretmen-cevap-anahtari-sayfasi',
  standalone: false,
  templateUrl: './ogretmen-cevap-anahtari-sayfasi.component.html',
  styleUrl: './ogretmen-cevap-anahtari-sayfasi.component.scss',
})
export class OgretmenCevapAnahtariSayfasiComponent
  implements OnInit, OnDestroy
{
  cevapAnahtari: CevapAnahtari = new CevapAnahtari();
  imagePreview: string | null = null;
  submitting = false;
  successMessage = '';
  errorMessage = '';
  cevapAnahtarlari: CevapAnahtari[] = [];
  loading = true;
  maxSoruSayisi = 100;
  searchQuery = '';
  showAddForm = false;
  error: string | null = null;
  konular: any[] = [];
  loadingKonular = false;

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
    this.loadKonular();

    // ESC tuşu ile modalı kapatma
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.editMode) {
        this.cancelEdit();
      }
    });
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
      aktiflik: true,
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
    formData.append('aktiflik', this.cevapAnahtari.aktiflik ? '1' : '0');

    // Dosya ekle
    const fileInput = document.getElementById(
      'sinav_kapagi'
    ) as HTMLInputElement;
    if (fileInput.files && fileInput.files.length > 0) {
      formData.append('sinav_kapagi', fileInput.files[0]);
    }
    // API'ye gönder
    this.http.post(`./server/api/cevap-anahtari-ekle.php`, formData).subscribe(
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
    this.error = null;
    
    // Token'ı al ve kontrol et
    let token = '';
    let user = null;
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      try {
        user = JSON.parse(userStr);
        token = user.token || '';
        console.log('Token bulundu:', token ? 'Var' : 'Yok');
        console.log('Kullanıcı bilgileri:', { id: user.id, name: user.adi_soyadi, rutbe: user.rutbe });
      } catch (e) {
        console.error('Kullanıcı bilgisi parse hatası:', e);
      }
    }

    if (!token) {
      this.loading = false;
      this.error = 'Oturum bilgileri bulunamadı. Lütfen tekrar giriş yapın.';
      return;
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    console.log('API çağrısı yapılıyor: cevap-anahtarlari-listele.php');

    this.http.get<any>('./server/api/cevap-anahtarlari-listele.php', { headers }).subscribe({
      next: (response: any) => {
        console.log('API yanıtı:', response);
        this.loading = false;
        if (response.success) {
          this.cevapAnahtarlari = response.data || [];
          console.log('Yüklenen cevap anahtarları sayısı:', this.cevapAnahtarlari.length);
        } else {
          console.error('API hatası:', response);
          this.cevapAnahtarlari = [];
          this.error = response.error || response.message || 'Bilinmeyen hata';
          this.showError(
            'Cevap anahtarları yüklenirken bir hata oluştu: ' + this.error
          );
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

  // Modal backdrop click handler
  onModalBackdropClick(event: MouseEvent) {
    // Sadece backdrop'a tıklandığında modalı kapat
    if (event.target === event.currentTarget) {
      this.cancelEdit();
    }
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
    formData.append(
      'aktiflik',
      this.currentEditingCevapAnahtari.aktiflik ? '1' : '0'
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
    // Scroll'u geri etkinleştir
    document.body.style.overflow = '';
  }
  deleteCevapAnahtari(id: number) {
    if (confirm('Bu cevap anahtarını silmek istediğinize emin misiniz?')) {
      this.http.post(`./server/api/cevap-anahtari-sil.php`, { id }).subscribe(
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
            'Sunucu hatası: ' + (error.message || 'Bilinmeyen bir hata oluştu.')
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

  // Filtreleme için getter
  get filteredCevapAnahtarlari(): CevapAnahtari[] {
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

  // İstatistik metodları
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

  // Sınav türüne göre renk
  getExamTypeColor(sinavTuru: string): string {
    const colors: { [key: string]: string } = {
      TYT: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      AYT: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      TAR: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      TEST: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    };
    return (
      colors[sinavTuru] || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    );
  }

  loadKonular() {
    this.loadingKonular = true;
    this.http.get<any>('./server/api/konu_listesi.php').subscribe({
      next: (response) => {
        this.loadingKonular = false;
        if (response.success) {
          this.konular = response.konular || [];
          console.log('Konular yüklendi:', this.konular);
        } else {
          console.error('Konular yüklenirken hata:', response.message);
          this.konular = [];
        }
      },
      error: (error) => {
        this.loadingKonular = false;
        console.error('Konular yüklenirken hata:', error);
        this.konular = [];
      },
    });
  }

  // Konu seçimi için filtreleme
  filterKonular(searchTerm: string): any[] {
    if (!searchTerm) return this.konular;
    return this.konular.filter((konu) =>
      konu.konu_adi.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }
}
