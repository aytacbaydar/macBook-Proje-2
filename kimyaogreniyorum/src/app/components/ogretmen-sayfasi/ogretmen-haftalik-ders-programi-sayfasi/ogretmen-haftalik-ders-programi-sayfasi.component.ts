import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

interface DersProgram {
  id: number;
  adi_soyadi: string;
  grubu: string;
  sinifi: string;
  ders_gunu: string;
  ders_saati: string;
  ucret: number;
}

interface GunlukDersler {
  [gun: string]: DersProgram[];
}

@Component({
  selector: 'app-ogretmen-haftalik-ders-programi-sayfasi',
  standalone: false,
  templateUrl: './ogretmen-haftalik-ders-programi-sayfasi.component.html',
  styleUrl: './ogretmen-haftalik-ders-programi-sayfasi.component.scss'
})
export class OgretmenHaftalikDersProgramiSayfasiComponent implements OnInit {
  dersProgram: DersProgram[] = [];
  gunlukDersler: GunlukDersler = {};
  gunler: string[] = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
  grupRenkleri: { [key: string]: string } = {};
  isLoading = false;
  error = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadDersProgram();
  }

  private getAuthHeaders(): HttpHeaders {
    const token = this.getTokenFromStorage();
    console.log('Auth Headers - Token:', token);
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  private getTokenFromStorage(): string {
    // İlk olarak localStorage'dan token'ı dene
    let token = localStorage.getItem('token');

    if (!token) {
      // Eğer token yoksa, user objesinden token'ı al
      const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          // Token'ı farklı yerlerde arıyoruz
          token = user.token || user.accessToken || user.authToken;

          // Eğer hala token yoksa, manuel olarak oluştur
          if (!token && user.id && user.email && user.sifre) {
            // Backend'de kullanılan MD5 hash'ini oluştur
            const crypto = require('crypto-js');
            token = crypto.MD5(user.id + user.email + user.sifre).toString();
          }
        } catch (error) {
          console.error('User data parse hatası:', error);
        }
      }
    }

    console.log('Token found:', token ? 'Yes' : 'No');
    return token || '';
  }

  loadDersProgram(): void {
    this.isLoading = true;
    this.error = '';

    const headers = this.getAuthHeaders();

    this.http.get<any>('./server/api/ogretmen_haftalik_program.php', { headers }).subscribe({
        next: (response) => {
          console.log('API Response:', response);
          if (response.success) {
            this.dersProgram = response.data || [];
            this.error = '';
          } else {
            this.error = response.message || 'Ders programı yüklenirken hata oluştu';
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Ders programı yüklenirken hata:', error);

          // Token sorunu varsa yeniden login yapmayı öner
          if (error.status === 401) {
            this.error = 'Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.';
            // İsteğe bağlı: kullanıcıyı login sayfasına yönlendir
            // this.router.navigate(['/']);
          } else {
            this.error = `Ders programı yüklenirken hata: ${error.error?.error || error.message}`;
          }
          this.isLoading = false;
        }
      });
  }

  organizeDersByDays(): void {
    this.gunlukDersler = {};

    // Her gün için boş array oluştur
    this.gunler.forEach(gun => {
      this.gunlukDersler[gun] = [];
    });

    // Dersleri günlere göre organize et
    this.dersProgram.forEach(ders => {
      if (ders.ders_gunu && this.gunlukDersler[ders.ders_gunu]) {
        this.gunlukDersler[ders.ders_gunu].push(ders);
      }
    });

    // Her günün derslerini saate göre sırala
    Object.keys(this.gunlukDersler).forEach(gun => {
      this.gunlukDersler[gun].sort((a, b) => {
        return a.ders_saati.localeCompare(b.ders_saati);
      });
    });
  }

  generateGroupColors(): void {
    const colors = [
      '#3498db', // Mavi
      '#e74c3c', // Kırmızı
      '#2ecc71', // Yeşil
      '#f39c12', // Turuncu
      '#9b59b6', // Mor
      '#1abc9c', // Turkuaz
      '#34495e', // Koyu gri
      '#e67e22', // Koyu turuncu
      '#95a5a6', // Açık gri
      '#c0392b'  // Koyu kırmızı
    ];

    const uniqueGroups = [...new Set(this.dersProgram.map(ders => `${ders.grubu}-${ders.sinifi}`))];

    uniqueGroups.forEach((group, index) => {
      this.grupRenkleri[group] = colors[index % colors.length];
    });
  }

  getGroupColor(grubu: string, sinifi: string): string {
    const groupKey = `${grubu}-${sinifi}`;
    return this.grupRenkleri[groupKey] || '#3498db';
  }

  getGroupDisplayName(grubu: string, sinifi: string): string {
    return `${grubu}-${sinifi}`;
  }

  formatTime(time: string): string {
    return time;
  }

  getTotalLessonsForDay(gun: string): number {
    return this.gunlukDersler[gun]?.length || 0;
  }

  getTotalWeeklyLessons(): number {
    return this.dersProgram.length;
  }
}