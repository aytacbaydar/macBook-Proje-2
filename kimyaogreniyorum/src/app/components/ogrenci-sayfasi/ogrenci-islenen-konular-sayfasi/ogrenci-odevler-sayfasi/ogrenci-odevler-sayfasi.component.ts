
import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-ogrenci-odevler-sayfasi',
  standalone: false,
  templateUrl: './ogrenci-odevler-sayfasi.component.html',
  styleUrl: './ogrenci-odevler-sayfasi.component.scss'
})
export class OgrenciOdevlerSayfasiComponent implements OnInit {
  odevler: any[] = [];
  isLoading: boolean = true;
  studentInfo: any = null;

  constructor(
    private http: HttpClient,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.loadStudentInfo();
    this.loadOdevler();
  }

  private loadStudentInfo(): void {
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      this.studentInfo = JSON.parse(userStr);
    }
  }

  private getAuthHeaders(): HttpHeaders {
    let token = '';
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      token = user.token || '';
    }

    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  loadOdevler(): void {
    this.isLoading = true;

    this.http.get<any>('./server/api/ogrenci_odevleri.php', {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.odevler = response.data || [];
          console.log('Ödevler yüklendi:', this.odevler);
        } else {
          this.toastr.error(response.message || 'Ödevler yüklenemedi', 'Hata');
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Ödevler yüklenirken hata:', error);
        this.toastr.error('Ödevler yüklenirken hata oluştu', 'Hata');
        this.isLoading = false;
      }
    });
  }

  openPdf(pdfPath: string): void {
    if (pdfPath) {
      const fullPath = `./server/${pdfPath}`;
      window.open(fullPath, '_blank');
    } else {
      this.toastr.warning('Bu ödev için PDF dosyası bulunmuyor', 'Uyarı');
    }
  }

  getDurumClass(durum: string): string {
    switch (durum) {
      case 'aktif':
        return 'aktif';
      case 'süresi_dolmuş':
        return 'suresi-dolmus';
      default:
        return '';
    }
  }

  getDurumText(durum: string): string {
    switch (durum) {
      case 'aktif':
        return 'Aktif';
      case 'süresi_dolmuş':
        return 'Süresi Dolmuş';
      default:
        return 'Bilinmiyor';
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR');
  }

  getKalanGunText(kalanGun: number): string {
    if (kalanGun === 0) {
      return 'Son gün!';
    } else if (kalanGun === 1) {
      return '1 gün kaldı';
    } else {
      return `${kalanGun} gün kaldı`;
    }
  }

  getUrgencyClass(kalanGun: number): string {
    if (kalanGun === 0) {
      return 'son-gun';
    } else if (kalanGun <= 2) {
      return 'acil';
    } else if (kalanGun <= 5) {
      return 'yakin';
    } else {
      return 'normal';
    }
  }

  // İstatistik metodları
  getAktifOdevSayisi(): number {
    return this.odevler.filter(odev => odev.durum === 'aktif').length;
  }

  getAcilOdevSayisi(): number {
    return this.odevler.filter(odev => 
      odev.durum === 'aktif' && odev.kalan_gun <= 2
    ).length;
  }

  getGecmisOdevSayisi(): number {
    return this.odevler.filter(odev => odev.durum === 'süresi_dolmuş').length;
  }

  // Ödev yeniden yükleme metodu
  refreshOdevler(): void {
    this.loadOdevler();
  }
}
