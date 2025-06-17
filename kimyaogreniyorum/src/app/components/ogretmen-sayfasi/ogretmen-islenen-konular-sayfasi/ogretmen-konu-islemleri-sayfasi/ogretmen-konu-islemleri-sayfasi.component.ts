
import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

interface Konu {
  id: number;
  konu_adi: string;
  unite_adi: string;
  sinif_seviyesi: string;
  aciklama?: string;
  olusturma_tarihi: string;
}

@Component({
  selector: 'app-ogretmen-konu-islemleri-sayfasi',
  templateUrl: './ogretmen-konu-islemleri-sayfasi.component.html',
  styleUrl: './ogretmen-konu-islemleri-sayfasi.component.scss'
})
export class OgretmenKonuIslemleriSayfasiComponent implements OnInit {
  konular: Konu[] = [];
  filteredKonular: Konu[] = [];
  isLoading = false;
  error = '';
  searchQuery = '';
  selectedSinif = '';
  selectedUnite = '';
  
  // Modal states
  showKonuModal = false;
  showDeleteModal = false;
  editingKonu: Konu | null = null;
  deletingKonu: Konu | null = null;
  
  // Form data
  formData = {
    konu_adi: '',
    unite_adi: '',
    sinif_seviyesi: '9',
    aciklama: ''
  };
  
  // Options
  sinifOptions = ['9', '10', '11', '12'];
  uniteOptions: string[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadKonular();
  }

  private getAuthHeaders(): HttpHeaders {
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.token) {
        headers = headers.set('Authorization', `Bearer ${user.token}`);
      }
    }
    
    return headers;
  }

  loadKonular(): void {
    this.isLoading = true;
    this.error = '';
    
    this.http.get<any>('https://www.kimyaogreniyorum.com/server/api/konu_listesi.php', {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.success) {
          this.konular = response.konular || [];
          this.filteredKonular = [...this.konular];
          this.extractUniteOptions();
          this.applyFilters();
        } else {
          this.error = response.message || 'Konular yüklenirken hata oluştu';
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.error = 'Konular yüklenirken hata oluştu: ' + (error.message || 'Bilinmeyen hata');
        console.error('Konu listesi hatası:', error);
      }
    });
  }

  extractUniteOptions(): void {
    const unites = new Set<string>();
    this.konular.forEach(konu => {
      if (konu.unite_adi) {
        unites.add(konu.unite_adi);
      }
    });
    this.uniteOptions = Array.from(unites).sort();
  }

  applyFilters(): void {
    this.filteredKonular = this.konular.filter(konu => {
      const matchesSearch = !this.searchQuery || 
        konu.konu_adi.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        konu.unite_adi.toLowerCase().includes(this.searchQuery.toLowerCase());
      
      const matchesSinif = !this.selectedSinif || konu.sinif_seviyesi === this.selectedSinif;
      const matchesUnite = !this.selectedUnite || konu.unite_adi === this.selectedUnite;
      
      return matchesSearch && matchesSinif && matchesUnite;
    });
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  onSinifChange(): void {
    this.applyFilters();
  }

  onUniteChange(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedSinif = '';
    this.selectedUnite = '';
    this.applyFilters();
  }

  openKonuModal(konu?: Konu): void {
    this.editingKonu = konu || null;
    
    if (konu) {
      this.formData = {
        konu_adi: konu.konu_adi,
        unite_adi: konu.unite_adi,
        sinif_seviyesi: konu.sinif_seviyesi,
        aciklama: konu.aciklama || ''
      };
    } else {
      this.formData = {
        konu_adi: '',
        unite_adi: '',
        sinif_seviyesi: '9',
        aciklama: ''
      };
    }
    
    this.showKonuModal = true;
  }

  closeKonuModal(): void {
    this.showKonuModal = false;
    this.editingKonu = null;
  }

  saveKonu(): void {
    if (!this.formData.konu_adi.trim() || !this.formData.unite_adi.trim()) {
      alert('Konu adı ve ünite adı gereklidir!');
      return;
    }

    const url = this.editingKonu 
      ? 'https://www.kimyaogreniyorum.com/server/api/konu_guncelle.php'
      : 'https://www.kimyaogreniyorum.com/server/api/konu_ekle.php';

    const payload = this.editingKonu 
      ? { ...this.formData, id: this.editingKonu.id }
      : this.formData;

    this.http.post<any>(url, payload, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.closeKonuModal();
          this.loadKonular();
          alert(this.editingKonu ? 'Konu başarıyla güncellendi!' : 'Konu başarıyla eklendi!');
        } else {
          alert(response.message || 'İşlem başarısız!');
        }
      },
      error: (error) => {
        console.error('Konu kaydetme hatası:', error);
        alert('Konu kaydedilirken hata oluştu!');
      }
    });
  }

  openDeleteModal(konu: Konu): void {
    this.deletingKonu = konu;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.deletingKonu = null;
  }

  deleteKonu(): void {
    if (!this.deletingKonu) return;

    this.http.delete<any>(`https://www.kimyaogreniyorum.com/server/api/konu_sil.php?id=${this.deletingKonu.id}`, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.closeDeleteModal();
          this.loadKonular();
          alert('Konu başarıyla silindi!');
        } else {
          alert(response.message || 'Silme işlemi başarısız!');
        }
      },
      error: (error) => {
        console.error('Konu silme hatası:', error);
        alert('Konu silinirken hata oluştu!');
      }
    });
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
