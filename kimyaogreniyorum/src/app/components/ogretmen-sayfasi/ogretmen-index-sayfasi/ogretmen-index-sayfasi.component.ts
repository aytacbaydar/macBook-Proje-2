import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';

interface Ogrenci {
  id: number;
  ogrenci_adi_soyadi: string;
  email: string;
  cep_telefonu: string;
  ders_gunu: string;
  ders_saati: string;
  ucret: string;
  created_at: string;
}

@Component({
  selector: 'app-ogretmen-index-sayfasi',
  templateUrl: './ogretmen-index-sayfasi.component.html',
  styleUrls: ['./ogretmen-index-sayfasi.component.scss'],
  standalone: false
})
export class OgretmenIndexSayfasiComponent implements OnInit {
  ogrencilerim: Ogrenci[] = [];
  loading = false;
  error = '';

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadOgrencilerim();
  }

  loadOgrencilerim(): void {
    this.loading = true;
    this.error = '';

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.token) {
      this.error = 'Giriş yapmanız gerekiyor';
      this.loading = false;
      return;
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${user.token}`,
      'Content-Type': 'application/json'
    });

    this.http.get<any>('/server/api/ogretmen_ogrencileri.php', { headers })
      .subscribe({
        next: (response) => {
          this.loading = false;
          if (response.success) {
            this.ogrencilerim = response.data || [];
          } else {
            this.error = response.error || 'Öğrenciler yüklenirken hata oluştu';
          }
        },
        error: (error) => {
          this.loading = false;
          this.error = 'Öğrenciler yüklenirken hata oluştu: ' + error.message;
          console.error('Öğrenci yükleme hatası:', error);
        }
      });
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'Belirtilmemiş';
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR');
  }

  logout(): void {
    localStorage.removeItem('user');
    sessionStorage.removeItem('user');
    this.router.navigate(['/']);
  }
}