import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

interface OptikCevap {
  [key: string]: string; // 'soru1': 'A', 'soru2': 'B', etc.
}

@Component({
  selector: 'app-ogrenci-optik-sayfasi',
  standalone: false,
  templateUrl: './ogrenci-optik-sayfasi.component.html',
  styleUrl: './ogrenci-optik-sayfasi.component.scss',
})
export class OgrenciOptikSayfasiComponent implements OnInit {
  sinavId: number = 0;
  sinavAdi: string = '';
  sinavTuru: string = '';
  soruSayisi: number = 0;

  cevaplar: OptikCevap = {};
  siklar = ['A', 'B', 'C', 'D', 'E'];
  sorular: number[] = [];

  submitting = false;
  error: string | null = null;
  successMessage = '';
  message: string = '';
  messageType: 'success' | 'info' | 'warning' | 'error' = 'info';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit() {
    // URL parametrelerini al
    this.route.queryParams.subscribe(params => {
      this.sinavId = +params['sinavId'] || 0;
      this.sinavAdi = params['sinavAdi'] || '';
      this.sinavTuru = params['sinavTuru'] || '';
      this.soruSayisi = +params['soruSayisi'] || 0;
      const isRetake = params['retake'] === 'true';

      if (isRetake) {
        this.showRetakeWarning();
      }

      if (!this.sinavId || !this.soruSayisi) {
        this.router.navigate(['/ogrenci/sinav-islemleri']);
        return;
      }

      this.initializeSorular();
    });
  }

  initializeSorular() {
    this.sorular = Array(this.soruSayisi)
      .fill(0)
      .map((_, i) => i + 1);
    // Initialize all answers as empty
    for (let i = 1; i <= this.soruSayisi; i++) {
      this.cevaplar[`soru${i}`] = '';
    }
  }

  selectAnswer(soruNo: number, sikCevap: string) {
    this.cevaplar[`soru${soruNo}`] = sikCevap;
  }

  isSelected(soruNo: number, sikCevap: string): boolean {
    return this.cevaplar[`soru${soruNo}`] === sikCevap;
  }

  getAnsweredCount(): number {
    return Object.values(this.cevaplar).filter((cevap) => cevap !== '').length;
  }

  getUnansweredCount(): number {
    return this.soruSayisi - this.getAnsweredCount();
  }

  clearAnswer(soruNo: number) {
    this.cevaplar[`soru${soruNo}`] = '';
  }

  submitAnswers() {
    if (this.getUnansweredCount() > 0) {
      const result = confirm(
        `${this.getUnansweredCount()} soru boş kaldı. Yine de sınavı bitirmek istiyor musunuz?`
      );
      if (!result) return;
    }

    this.submitting = true;
    this.error = null;
    this.successMessage = '';

    // Get student info
    const userStr =
      localStorage.getItem('user') || sessionStorage.getItem('user');
    if (!userStr) {
      this.error = 'Öğrenci bilgisi bulunamadı.';
      this.submitting = false;
      return;
    }

    let studentId = 0;
    try {
      const user = JSON.parse(userStr);
      studentId = user.id || 0;
    } catch (error) {
      this.error = 'Öğrenci bilgisi geçersiz.';
      this.submitting = false;
      return;
    }

    const data = {
      sinav_id: this.sinavId,
      ogrenci_id: studentId,
      cevaplar: this.cevaplar,
      sinav_adi: this.sinavAdi,
      sinav_turu: this.sinavTuru,
      soru_sayisi: this.soruSayisi,
    };

    this.http.post('./server/api/sinav_cevaplari_kaydet.php', data).subscribe({
      next: (response: any) => {
        if (response.success) {
            this.submitting = false;
            this.successMessage = 'Cevaplarınız başarıyla kaydedildi! Sonuçlar sayfasına yönlendiriliyorsunuz...';
            this.error = null;
            console.log('Cevaplar kaydedildi:', response);

            // Başarılı kayıt sonrası sınav sonuçları sayfasına yönlendir
            setTimeout(() => {
              // localStorage'dan öğrenci ID'sini al
              const userData = JSON.parse(localStorage.getItem('user') || '{}');
              const ogrenciId = userData.id;

              this.router.navigate(['/ogrenci-sayfasi/sinav-sonuclari'], {
                queryParams: {
                  sinavId: this.sinavId,
                  ogrenciId: ogrenciId
                }
              });
            }, 1500);
          } else {
          this.error =
            response.message || 'Cevaplar kaydedilirken hata oluştu.';
        }
      },
      error: (error) => {
        this.submitting = false;
        this.error = 'Sunucu hatası: ' + (error.message || 'Bağlantı hatası');
        console.error('Cevap kaydetme hatası:', error);
      },
    });
  }

  goBack() {
    const result = confirm(
      'Sınavdan çıkmak istediğinize emin misiniz? Cevaplarınız kaydedilmeyecek!'
    );
    if (result) {
      this.router.navigate([
        '/ogrenci-sayfasi/ogrenci-sinav-islemleri-sayfasi',
      ]);
    }
  }

  getSinavTuruColor(): string {
    const colors: { [key: string]: string } = {
      'TYT': '#667eea',
      'AYT': '#4facfe',
      'TAR': '#43e97b',
      'TEST': '#fa709a'
    };
    return colors[this.sinavTuru] || '#6c757d';
  }

  showRetakeWarning() {
    this.message = `Bu sınavı daha önce çözmüştünüz. Yeni cevaplarınız önceki sonuçlarınızın yerine geçecektir.`;
    this.messageType = 'warning';

    // Mesajı 5 saniye sonra gizle
    setTimeout(() => {
      this.message = '';
    }, 5000);
  }

  getCompletionPercent(): number {
    if (!this.soruSayisi || this.soruSayisi === 0) return 0;
    return Math.round((this.getAnsweredCount() / this.soruSayisi) * 100);
  }

  formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  private getOgrenciId(): number {
    // localStorage'dan öğrenci bilgilerini al
    const userDataString = localStorage.getItem('userData');
    if (userDataString) {
      try {
        const userData = JSON.parse(userDataString);
        return userData.id || 0;
      } catch (error) {
        console.error('Öğrenci ID alınamadı:', error);
        return 0;
      }
    }
    return 0;
  }
}