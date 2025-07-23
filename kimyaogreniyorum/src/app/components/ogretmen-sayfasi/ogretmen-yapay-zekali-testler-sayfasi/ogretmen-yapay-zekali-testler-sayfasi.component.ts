
import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface Soru {
  id?: number;
  konu_adi: string;
  sinif_seviyesi: string;
  zorluk_derecesi: 'kolay' | 'orta' | 'zor';
  soru_aciklamasi: string;
  soru_resmi?: string;
  dogru_cevap: 'A' | 'B' | 'C' | 'D' | 'E';
  ogretmen_id: number;
  olusturma_tarihi?: string;
}

interface TeacherInfo {
  id: number;
  adi_soyadi: string;
  email: string;
}

@Component({
  selector: 'app-ogretmen-yapay-zekali-testler-sayfasi',
  standalone: false,
  templateUrl: './ogretmen-yapay-zekali-testler-sayfasi.component.html',
  styleUrl: './ogretmen-yapay-zekali-testler-sayfasi.component.scss',
})
export class OgretmenYapayZekaliTestlerSayfasiComponent implements OnInit {
  teacherInfo: TeacherInfo | null = null;
  sorular: Soru[] = [];

  // Confirm dialog
  showConfirmDialog = false;
  confirmDialogData = {
    title: 'Onay',
    message: 'Bu işlemi gerçekleştirmek istediğinizden emin misiniz?',
    confirmText: 'Evet',
    cancelText: 'Hayır',
    type: 'warning' as 'warning' | 'danger' | 'info' | 'success',
    action: null as (() => void) | null,
  };

  // Form verileri
  yeniSoru: Soru = {
    konu_adi: '',
    sinif_seviyesi: '9',
    zorluk_derecesi: 'kolay',
    soru_aciklamasi: '',
    dogru_cevap: 'A',
    ogretmen_id: 0,
  };

  // UI state
  showAddForm = false;
  loading = false;
  error: string | null = null;
  success: string | null = null;

  // Resim upload
  selectedFile: File | null = null;
  imagePreview: string | null = null;

  // Filtreler
  filterKonu = '';
  filterZorluk = '';

  // Sayfalama
  currentPage = 1;
  itemsPerPage = 10;

  // Sabitler
  sinifSeviyeleri = ['9', '10', '11', '12'];
  zorlukDereceleri = [
    { value: 'kolay', label: 'Kolay' },
    { value: 'orta', label: 'Orta' },
    { value: 'zor', label: 'Zor' },
  ];

  konuListesi: string[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadTeacherInfo();
    this.loadKonuListesi();
    this.loadSorular();
  }

  private loadTeacherInfo(): void {
    const userStr =
      localStorage.getItem('user') || sessionStorage.getItem('user');

    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        this.teacherInfo = {
          id: user.id,
          adi_soyadi: user.adi_soyadi || 'Öğretmen',
          email: user.email || '',
        };
        this.yeniSoru.ogretmen_id = user.id;
      } catch (error) {
        console.error('Teacher info loading error:', error);
        this.error = 'Öğretmen bilgileri yüklenemedi';
      }
    } else {
      this.error = 'Öğretmen bilgisi bulunamadı';
    }
  }

  loadSorular(): void {
    if (!this.teacherInfo) return;

    this.loading = true;
    this.error = null;

    let url = `./server/api/soru_yonetimi.php?action=list&ogretmen_id=${this.teacherInfo.id}`;

    if (this.filterKonu) {
      url += `&konu_adi=${encodeURIComponent(this.filterKonu)}`;
    }

    if (this.filterZorluk) {
      url += `&zorluk_derecesi=${this.filterZorluk}`;
    }

    this.http.get<any>(url).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success) {
          this.sorular = response.data || [];
        } else {
          this.error = response.message || 'Sorular yüklenemedi';
        }
      },
      error: (error) => {
        this.loading = false;
        this.error =
          'Sorular yüklenirken hata oluştu: ' +
          (error.error?.message || error.message);
      },
    });
  }

  toggleAddForm(): void {
    this.showAddForm = !this.showAddForm;
    if (this.showAddForm) {
      this.resetForm();
    }
  }

  resetForm(): void {
    this.yeniSoru = {
      konu_adi: '',
      sinif_seviyesi: '9',
      zorluk_derecesi: 'kolay',
      soru_aciklamasi: '',
      dogru_cevap: 'A',
      ogretmen_id: this.teacherInfo?.id || 0,
    };
    this.selectedFile = null;
    this.imagePreview = null;
    this.error = null;
    this.success = null;
  }

  validateForm(): boolean {
    if (!this.yeniSoru.konu_adi.trim()) {
      this.error = 'Konu adı gerekli';
      return false;
    }

    // Soru resmi zorunlu (çünkü şıklar fotoğrafta olacak)
    if (!this.selectedFile) {
      this.error = 'Soru resmi gerekli';
      return false;
    }

    return true;
  }

  saveSoru(): void {
    if (!this.validateForm()) return;

    this.loading = true;
    this.error = null;
    this.success = null;

    const formData = new FormData();
    formData.append('konu_adi', this.yeniSoru.konu_adi);
    formData.append('sinif_seviyesi', this.yeniSoru.sinif_seviyesi);
    formData.append('zorluk_derecesi', this.yeniSoru.zorluk_derecesi);
    formData.append('soru_aciklamasi', this.yeniSoru.soru_aciklamasi);
    formData.append('dogru_cevap', this.yeniSoru.dogru_cevap);
    formData.append('ogretmen_id', this.yeniSoru.ogretmen_id.toString());

    if (this.selectedFile) {
      formData.append('soru_resmi', this.selectedFile);
    }

    this.http.post<any>('./server/api/soru_yonetimi.php', formData).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success) {
          this.success = 'Soru başarıyla eklendi';
          this.showAddForm = false;
          this.resetForm();
          this.loadSorular();
        } else {
          this.error = response.message || 'Soru eklenemedi';
        }
      },
      error: (error) => {
        this.loading = false;
        this.error =
          'Soru eklenirken hata oluştu: ' +
          (error.error?.message || error.message);
      },
    });
  }

  deleteSoru(soru: Soru): void {
    // Set confirm dialog data
    this.confirmDialogData.action = () => {
      this.loading = true;

      this.http
        .delete<any>(
          `./server/api/soru_yonetimi.php?id=${soru.id}&ogretmen_id=${this.teacherInfo?.id}`
        )
        .subscribe({
          next: (response) => {
            this.loading = false;
            if (response.success) {
              this.success = 'Soru başarıyla silindi';
              this.loadSorular();
            } else {
              this.error = response.message || 'Soru silinemedi';
            }
          },
          error: (error) => {
            this.loading = false;
            this.error =
              'Soru silinirken hata oluştu: ' +
              (error.error?.message || error.message);
          },
        });
    };

    // Show confirm dialog
    this.showConfirmDialog = true;
  }

  // Confirm dialog metodu
  onConfirmDialogConfirmed(): void {
    if (this.confirmDialogData.action) {
      this.confirmDialogData.action();
    }
    this.showConfirmDialog = false;
  }

  onConfirmDialogCancelled(): void {
    this.showConfirmDialog = false;
  }

  getFilteredSorular(): Soru[] {
    return this.sorular.filter((soru) => {
      const konuMatch =
        !this.filterKonu ||
        soru.konu_adi.toLowerCase().includes(this.filterKonu.toLowerCase());
      const zorlukMatch =
        !this.filterZorluk || soru.zorluk_derecesi === this.filterZorluk;
      return konuMatch && zorlukMatch;
    });
  }

  getPaginatedSorular(): Soru[] {
    const filtered = this.getFilteredSorular();
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return filtered.slice(startIndex, startIndex + this.itemsPerPage);
  }

  getTotalPages(): number {
    return Math.ceil(this.getFilteredSorular().length / this.itemsPerPage);
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.getTotalPages()) {
      this.currentPage = page;
    }
  }

  getZorlukBadgeClass(zorluk: string): string {
    switch (zorluk) {
      case 'kolay':
        return 'badge-success';
      case 'orta':
        return 'badge-warning';
      case 'zor':
        return 'badge-danger';
      default:
        return 'badge-secondary';
    }
  }

  getZorlukText(zorluk: string): string {
    switch (zorluk) {
      case 'kolay':
        return 'Kolay';
      case 'orta':
        return 'Orta';
      case 'zor':
        return 'Zor';
      default:
        return zorluk;
    }
  }

  clearMessages(): void {
    this.error = null;
    this.success = null;
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // Dosya türü kontrolü
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        this.error = 'Sadece JPG, PNG ve GIF dosyaları kabul edilir';
        return;
      }

      // Dosya boyutu kontrolü (5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.error = "Dosya boyutu 5MB'dan büyük olamaz";
        return;
      }

      this.selectedFile = file;
      this.error = null;

      // Resim önizlemesi
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imagePreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage(): void {
    this.selectedFile = null;
    this.imagePreview = null;
  }

  getSoruResmiUrl(soru: Soru): string {
    if (soru.soru_resmi) {
      return `./uploads/soru_resimleri/${soru.soru_resmi}`;
    }
    return '';
  }

  loadKonuListesi(): void {
    this.http.get<any>('./server/api/konu_listesi.php').subscribe({
      next: (response) => {
        if (response.success && response.konular) {
          // Tekrar eden konu adlarını kaldır ve alfabetik sırala
          const benzersizKonular = [
            ...new Set(response.konular.map((konu: any) => konu.konu_adi)),
          ] as string[];
          this.konuListesi = benzersizKonular.sort();
        } else {
          console.error('Konular yüklenirken hata:', response.message);
          // Hata durumunda varsayılan liste
          this.konuListesi = [
            'Atom ve Molekül',
            'Periyodik Sistem',
            'Kimyasal Bağlar',
            'Maddenin Halleri',
            'Çözeltiler',
            'Asit ve Bazlar',
            'Kimyasal Tepkimeler',
            'Gazlar',
            'Termokimya',
            'Kimyasal Denge',
            'Elektrokimya',
            'Organik Kimya',
          ];
        }
      },
      error: (error) => {
        console.error('Konular yüklenirken hata:', error);
        // Hata durumunda varsayılan liste
        this.konuListesi = [
          'Atom ve Molekül',
          'Periyodik Sistem',
          'Kimyasal Bağlar',
          'Maddenin Halleri',
          'Çözeltiler',
          'Asit ve Bazlar',
          'Kimyasal Tepkimeler',
          'Gazlar',
          'Termokimya',
          'Kimyasal Denge',
          'Elektrokimya',
          'Organik Kimya',
        ];
      },
    });
  }
}
