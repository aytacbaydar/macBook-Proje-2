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
  showPdfUploadForm = false;
  loading = false;
  error: string | null = null;
  success: string | null = null;

  // Resim upload
  selectedFile: File | null = null;
  imagePreview: string | null = null;

  // Filtreler
  filterKonu = '';
  filterZorluk = '';

  // Görünüm modu
  viewMode: 'list' | 'topics' = 'topics';
  selectedTopic: string | null = null;

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

  // PDF upload değişkenleri
  selectedPdfFile: File | null = null;
  pdfUploadData = {
    konu_adi: '',
    sinif_seviyesi: '9',
    zorluk_derecesi: 'kolay' as 'kolay' | 'orta' | 'zor',
    dogru_cevap: 'A'
  };
  pdfPages: string[] = [];
  currentPdfPage = 0;

  // PDF selection değişkenleri
  currentSelection: any = null;
  isSelecting = false;
  allSelections: { [pageIndex: number]: any[] } = {};
  currentPageSelections: any[] = [];

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

  // Görünüm modu değiştirme
  setViewMode(mode: 'list' | 'topics'): void {
    this.viewMode = mode;
    if (mode === 'list') {
      this.selectedTopic = null;
    }
  }

  // Konu seçimi
  selectTopic(konuAdi: string): void {
    this.selectedTopic = this.selectedTopic === konuAdi ? null : konuAdi;
  }

  // Konu seçimini temizle
  clearTopicSelection(): void {
    this.selectedTopic = null;
  }

  // Benzersiz konu sayısı
  getUniqueTopicsCount(): number {
    const uniqueTopics = [...new Set(this.sorular.map(soru => soru.konu_adi))];
    return uniqueTopics.length;
  }

  // Konuları sayılarıyla birlikte getir
  getTopicsWithCount(): any[] {
    const topicCounts: { [key: string]: { count: number, kolay: number, orta: number, zor: number } } = {};
    
    this.sorular.forEach(soru => {
      if (!topicCounts[soru.konu_adi]) {
        topicCounts[soru.konu_adi] = { count: 0, kolay: 0, orta: 0, zor: 0 };
      }
      topicCounts[soru.konu_adi].count++;
      
      // Zorluk derecesine göre sayıları artır
      if (soru.zorluk_derecesi === 'kolay') {
        topicCounts[soru.konu_adi].kolay++;
      } else if (soru.zorluk_derecesi === 'orta') {
        topicCounts[soru.konu_adi].orta++;
      } else if (soru.zorluk_derecesi === 'zor') {
        topicCounts[soru.konu_adi].zor++;
      }
    });

    return Object.keys(topicCounts)
      .map(konu_adi => ({
        konu_adi,
        count: topicCounts[konu_adi].count,
        kolay: topicCounts[konu_adi].kolay,
        orta: topicCounts[konu_adi].orta,
        zor: topicCounts[konu_adi].zor
      }))
      .sort((a, b) => b.count - a.count); // Soru sayısına göre sırala
  }

  // Seçili konuya göre filtrelenmiş sorular
  getFilteredQuestionsByTopic(): Soru[] {
    if (!this.selectedTopic) return [];
    
    return this.sorular
      .filter(soru => soru.konu_adi === this.selectedTopic)
      .sort((a, b) => {
        // Önce zorluk derecesine göre sırala
        const zorlukSirasi = { 'kolay': 1, 'orta': 2, 'zor': 3 };
        const zorlukFarki = zorlukSirasi[a.zorluk_derecesi] - zorlukSirasi[b.zorluk_derecesi];
        if (zorlukFarki !== 0) return zorlukFarki;
        
        // Sonra tarihe göre sırala (yeniden eskiye)
        return new Date(b.olusturma_tarihi || '').getTime() - new Date(a.olusturma_tarihi || '').getTime();
      });
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

      // Dosya boyutu kontrolü (10MB)
      if (file.size > 100 * 1024 * 1024) {
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

  // PDF Upload metodları
  togglePdfUploadForm(): void {
    this.showPdfUploadForm = !this.showPdfUploadForm;
    if (this.showPdfUploadForm) {
      this.showAddForm = false;
      this.resetPdfUploadData();
    }
  }

  resetPdfUploadData(): void {
    this.selectedPdfFile = null;
    this.pdfUploadData = {
      konu_adi: '',
      sinif_seviyesi: '9',
      zorluk_derecesi: 'kolay',
      dogru_cevap: 'A'
    };
    this.pdfPages = [];
    this.currentPdfPage = 0;
    this.allSelections = {};
    this.currentPageSelections = [];
    this.currentSelection = null;
    this.isSelecting = false;
    this.error = null;
    this.success = null;
    
    // DOM'dan mevcut seçimleri temizle
    const existingSelections = document.querySelectorAll('.existing-selection, .selection-overlay');
    existingSelections.forEach(el => el.remove());
    
    console.log('PDF upload verileri sıfırlandı');
  }

  onPdfFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // Dosya türü kontrolü
      if (file.type !== 'application/pdf') {
        this.error = 'Sadece PDF dosyaları kabul edilir';
        return;
      }

      // Dosya boyutu kontrolü (6MB)
      if (file.size > 100 * 1024 * 1024) {
        this.error = "Dosya boyutu 100MB'dan büyük olamaz";
        return;
      }

      // Önceki PDF verilerini temizle
      this.pdfPages = [];
      this.currentPdfPage = 0;
      this.allSelections = {};
      this.currentPageSelections = [];
      this.currentSelection = null;
      this.isSelecting = false;

      this.selectedPdfFile = file;
      this.error = null;
      this.success = null;
      
      console.log('Yeni PDF dosyası seçildi:', file.name, 'Boyut:', Math.round(file.size / 1024) + 'KB');
    } else {
      // Dosya seçimi iptal edildi
      this.selectedPdfFile = null;
      this.pdfPages = [];
      this.allSelections = {};
      this.currentPageSelections = [];
    }
  }

  processPdfQuestions(): void {
    if (!this.selectedPdfFile || !this.pdfUploadData.konu_adi) {
      this.error = 'PDF dosyası ve konu adı gerekli';
      return;
    }

    this.loading = true;
    this.error = null;
    this.success = null;

    // Önceki verileri temizle
    this.pdfPages = [];
    this.currentPdfPage = 0;
    this.allSelections = {};
    this.currentPageSelections = [];
    this.currentSelection = null;
    this.isSelecting = false;

    const formData = new FormData();
    formData.append('pdf_file', this.selectedPdfFile);
    formData.append('konu_adi', this.pdfUploadData.konu_adi);
    formData.append('sinif_seviyesi', this.pdfUploadData.sinif_seviyesi);
    formData.append('zorluk_derecesi', this.pdfUploadData.zorluk_derecesi);
    formData.append('dogru_cevap', this.pdfUploadData.dogru_cevap);
    
    // Benzersiz işlem ID'si ekle
    const processId = Date.now().toString();
    formData.append('process_id', processId);

    this.http.post<any>('./server/api/pdf_to_images.php', formData).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success) {
          this.pdfPages = response.pages || [];
          this.currentPdfPage = 0;
          this.allSelections = {};
          this.currentPageSelections = [];
          this.success = `PDF başarıyla işlendi. ${this.pdfPages.length} sayfa yüklendi.`;
          
          console.log('Yeni PDF işlendi:', {
            pages: this.pdfPages.length,
            processId: processId
          });
        } else {
          this.error = response.message || 'PDF işlenemedi';
        }
      },
      error: (error) => {
        this.loading = false;
        this.error = 'PDF işlenirken hata oluştu: ' + (error.error?.message || error.message);
      }
    });
  }

  // PDF Navigation metodları
  nextPdfPage(): void {
    if (this.currentPdfPage < this.pdfPages.length - 1) {
      this.saveCurrentPageSelections();
      this.currentPdfPage++;
      this.loadCurrentPageSelections();
    }
  }

  previousPdfPage(): void {
    if (this.currentPdfPage > 0) {
      this.saveCurrentPageSelections();
      this.currentPdfPage--;
      this.loadCurrentPageSelections();
    }
  }

  // Selection metodları
  onPdfPageImageLoad(event: any): void {
    // Görüntü yüklendiğinde çalışır
    console.log('PDF sayfa görüntüsü yüklendi:', this.pdfPages[this.currentPdfPage]);
  }

  onPdfPageImageError(event: any): void {
    console.error('PDF sayfa görüntüsü yüklenemedi:', this.pdfPages[this.currentPdfPage]);
    this.error = 'PDF sayfası yüklenemedi. Lütfen tekrar deneyin.';
  }

  startSelection(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    
    const img = event.target as HTMLImageElement;
    const rect = img.getBoundingClientRect();

    // Görüntülenen resmin gerçek boyutlarını al
    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;

    const relativeX = (event.clientX - rect.left) * scaleX;
    const relativeY = (event.clientY - rect.top) * scaleY;

    this.isSelecting = true;
    this.currentSelection = {
      startX: relativeX,
      startY: relativeY,
      x: relativeX,
      y: relativeY,
      width: 0,
      height: 0,
      scaleX: scaleX,
      scaleY: scaleY
    };

    // Mouse capture için event listener'ları ekle
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
  }

  private handleMouseMove(event: MouseEvent): void {
    if (!this.isSelecting || !this.currentSelection) return;

    event.preventDefault();
    
    // PDF container'ı bul
    const pdfContainer = document.querySelector('.pdf-page-container img') as HTMLImageElement;
    if (!pdfContainer) return;
    
    const rect = pdfContainer.getBoundingClientRect();
    const currentX = (event.clientX - rect.left) * this.currentSelection.scaleX;
    const currentY = (event.clientY - rect.top) * this.currentSelection.scaleY;

    this.currentSelection.x = Math.min(this.currentSelection.startX, currentX);
    this.currentSelection.y = Math.min(this.currentSelection.startY, currentY);
    this.currentSelection.width = Math.abs(currentX - this.currentSelection.startX);
    this.currentSelection.height = Math.abs(currentY - this.currentSelection.startY);
  }

  private handleMouseUp(event: MouseEvent): void {
    if (!this.isSelecting || !this.currentSelection) return;

    event.preventDefault();
    this.isSelecting = false;

    // Event listener'ları temizle
    document.removeEventListener('mousemove', this.handleMouseMove.bind(this));
    document.removeEventListener('mouseup', this.handleMouseUp.bind(this));

    // Minimum boyut kontrolü (daha büyük minimum boyut)
    const minWidth = 80;
    const minHeight = 80;
    
    if (this.currentSelection.width > minWidth && this.currentSelection.height > minHeight) {
      // Koordinatları yuvarla ve düzelt
      const selection = {
        x: Math.max(0, Math.round(this.currentSelection.x)),
        y: Math.max(0, Math.round(this.currentSelection.y)),
        width: Math.round(this.currentSelection.width),
        height: Math.round(this.currentSelection.height),
        pageIndex: this.currentPdfPage,
        dogru_cevap: this.pdfUploadData.dogru_cevap,
        timestamp: Date.now() // Benzersizlik için timestamp ekle
      };
      
      this.currentPageSelections.push(selection);
      
      console.log('Yeni soru seçimi eklendi:', selection);
      this.success = `Soru seçimi eklendi (${selection.width}x${selection.height})`;
      
      // Success mesajını 2 saniye sonra temizle
      setTimeout(() => {
        this.success = null;
      }, 2000);
    } else {
      console.log(`Seçim alanı çok küçük (${Math.round(this.currentSelection.width)}x${Math.round(this.currentSelection.height)}), minimum ${minWidth}x${minHeight} olmalı.`);
      this.error = `Seçim alanı çok küçük! Minimum ${minWidth}x${minHeight} piksel olmalı.`;
      
      // Error mesajını 3 saniye sonra temizle
      setTimeout(() => {
        this.error = null;
      }, 3000);
    }

    this.currentSelection = null;
  }

  updateSelection(event: MouseEvent): void {
    // Bu metod artık kullanılmıyor, handleMouseMove ile değiştirildi
    return;
  }

  endSelection(event: MouseEvent): void {
    // Bu metod artık kullanılmıyor, handleMouseUp ile değiştirildi
    return;
  }

  updateSelectionAnswer(selectionIndex: number, answer: string): void {
    if (this.currentPageSelections[selectionIndex]) {
      this.currentPageSelections[selectionIndex].dogru_cevap = answer;
    }
  }

  removeSelection(index: number): void {
    this.currentPageSelections.splice(index, 1);
  }

  clearCurrentPageSelections(): void {
    this.currentPageSelections = [];
  }

  saveCurrentPageSelections(): void {
    if (this.currentPageSelections.length > 0) {
      // Her seçimin doğru cevabının set edilmiş olduğundan emin ol
      this.currentPageSelections.forEach(selection => {
        if (!selection.dogru_cevap || selection.dogru_cevap === '') {
          selection.dogru_cevap = this.pdfUploadData.dogru_cevap;
        }
        console.log(`Sayfa ${this.currentPdfPage} - Soru doğru cevabı: ${selection.dogru_cevap}`);
      });
      this.allSelections[this.currentPdfPage] = [...this.currentPageSelections];
    } else if (this.allSelections[this.currentPdfPage]) {
      delete this.allSelections[this.currentPdfPage];
    }
  }

  loadCurrentPageSelections(): void {
    this.currentPageSelections = this.allSelections[this.currentPdfPage] || [];
  }

  validateSelection(selection: any): boolean {
    // Gerekli alanları kontrol et
    if (!selection || typeof selection !== 'object') {
      return false;
    }

    const requiredFields = ['x', 'y', 'width', 'height'];
    for (const field of requiredFields) {
      if (!(field in selection) || typeof selection[field] !== 'number' || isNaN(selection[field])) {
        return false;
      }
    }

    // Minimum boyut kontrolü
    if (selection.width < 50 || selection.height < 50) {
      return false;
    }

    // Negatif değer kontrolü
    if (selection.x < 0 || selection.y < 0) {
      return false;
    }

    return true;
  }

  getSelectionDisplayCoordinates(selection: any): any {
    // Görüntülenen image elementini bul
    const imgElement = document.querySelector('.pdf-page-container img') as HTMLImageElement;
    if (!imgElement) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const scaleX = imgElement.clientWidth / imgElement.naturalWidth;
    const scaleY = imgElement.clientHeight / imgElement.naturalHeight;

    return {
      x: selection.x * scaleX,
      y: selection.y * scaleY,
      width: selection.width * scaleX,
      height: selection.height * scaleY
    };
  }

  getTotalSelections(): number {
    return Object.values(this.allSelections).reduce((total, selections) => total + selections.length, 0) + this.currentPageSelections.length;
  }

  saveSelectedQuestions(): void {
    this.saveCurrentPageSelections();

    const totalSelections = this.getTotalSelections();
    if (totalSelections === 0) {
      this.error = 'En az bir soru seçmelisiniz';
      return;
    }

    this.loading = true;
    this.error = null;

    // Her seçimin gerekli bilgilere sahip olduğundan emin ol ve validate et
    const validatedSelections: { [pageIndex: number]: any[] } = {};
    let validSelectionCount = 0;
    
    Object.keys(this.allSelections).forEach(pageIndex => {
      const pageNum = parseInt(pageIndex);
      const pageSelections = this.allSelections[pageNum];
      
      if (Array.isArray(pageSelections)) {
        const validSelections = pageSelections
          .filter(selection => this.validateSelection(selection))
          .map((selection, index) => ({
            ...selection,
            dogru_cevap: selection.dogru_cevap || this.pdfUploadData.dogru_cevap,
            pageIndex: pageNum,
            selectionIndex: index,
            // Koordinatları tekrar validate et
            x: Math.max(0, Math.round(selection.x)),
            y: Math.max(0, Math.round(selection.y)),
            width: Math.round(selection.width),
            height: Math.round(selection.height)
          }));
        
        if (validSelections.length > 0) {
          validatedSelections[pageNum] = validSelections;
          validSelectionCount += validSelections.length;
        }
      }
    });

    if (validSelectionCount === 0) {
      this.loading = false;
      this.error = 'Geçerli soru seçimi bulunamadı. Lütfen daha büyük alanlar seçin.';
      return;
    }

    console.log('Kaydedilecek validasyon edilmiş seçimler:', validatedSelections);
    console.log('Geçerli soru sayısı:', validSelectionCount);

    const requestData = {
      selections: validatedSelections,
      konu_adi: this.pdfUploadData.konu_adi,
      sinif_seviyesi: this.pdfUploadData.sinif_seviyesi,
      zorluk_derecesi: this.pdfUploadData.zorluk_derecesi,
      ogretmen_id: this.teacherInfo?.id,
      dogru_cevap: this.pdfUploadData.dogru_cevap,
      total_questions: totalSelections
    };

    this.http.post<any>('./server/api/save_pdf_questions.php', requestData).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success) {
          this.success = `${response.saved_count} soru başarıyla kaydedildi`;
          this.showPdfUploadForm = false;
          this.resetPdfUploadData();
          this.loadSorular();
          
          console.log('Sorular başarıyla kaydedildi:', response.saved_count);
        } else {
          this.error = response.message || 'Sorular kaydedilemedi';
          console.error('Kaydetme hatası:', response);
        }
      },
      error: (error) => {
        this.loading = false;
        this.error = 'Sorular kaydedilirken hata oluştu: ' + (error.error?.message || error.message);
        console.error('HTTP hatası:', error);
      }
    });
  }
}