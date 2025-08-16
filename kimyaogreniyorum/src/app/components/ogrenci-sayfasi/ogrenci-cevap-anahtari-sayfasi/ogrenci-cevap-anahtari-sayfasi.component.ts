
import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface TestCevapAnahtari {
  id: number;
  test_adi: string;
  test_aciklamasi?: string;
  soru_sayisi: number;
  cevaplar: { [key: number]: string };
  olusturma_tarihi: string;
}

@Component({
  selector: 'app-ogrenci-cevap-anahtari-sayfasi',
  standalone: false,
  templateUrl: './ogrenci-cevap-anahtari-sayfasi.component.html',
  styleUrls: ['./ogrenci-cevap-anahtari-sayfasi.component.scss']
})
export class OgrenciCevapAnahtariSayfasiComponent implements OnInit {
  testler: TestCevapAnahtari[] = [];
  selectedTest: TestCevapAnahtari | null = null;
  loading = false;
  error: string | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadTestler();
  }

  loadTestler(): void {
    this.loading = true;
    this.http.get<any>('./server/api/test_cevap_anahtari_yonetimi.php').subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success) {
          this.testler = response.data;
        } else {
          this.error = response.message;
        }
      },
      error: (error) => {
        this.loading = false;
        this.error = 'Testler yüklenirken hata oluştu: ' + error.message;
      }
    });
  }

  selectTest(test: TestCevapAnahtari): void {
    this.loading = true;
    this.http.get<any>(`./server/api/test_cevap_anahtari_yonetimi.php?test_id=${test.id}`).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success) {
          this.selectedTest = response.data;
        } else {
          this.error = response.message;
        }
      },
      error: (error) => {
        this.loading = false;
        this.error = 'Test detayları yüklenirken hata oluştu: ' + error.message;
      }
    });
  }

  backToList(): void {
    this.selectedTest = null;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  getSoruArray(): number[] {
    if (!this.selectedTest) return [];
    return Array.from({ length: this.selectedTest.soru_sayisi }, (_, i) => i + 1);
  }

  clearError(): void {
    this.error = null;
  }
}
