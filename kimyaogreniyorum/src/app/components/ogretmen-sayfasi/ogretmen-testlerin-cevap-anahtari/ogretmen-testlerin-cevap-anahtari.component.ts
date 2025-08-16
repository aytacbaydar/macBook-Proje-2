
import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface TestCevapAnahtari {
  id?: number;
  test_adi: string;
  test_aciklamasi?: string;
  ogretmen_id: number;
  soru_sayisi: number;
  cevaplar: { [key: number]: string };
  olusturma_tarihi?: string;
  guncelleme_tarihi?: string;
  aktif?: boolean;
}

@Component({
  selector: 'app-ogretmen-testlerin-cevap-anahtari',
  standalone: false,
  templateUrl: './ogretmen-testlerin-cevap-anahtari.component.html',
  styleUrls: ['./ogretmen-testlerin-cevap-anahtari.component.scss']
})
export class OgretmenTestlerinCevapAnahtariComponent implements OnInit {
  testler: TestCevapAnahtari[] = [];
  showAddForm = false;
  editingTest: TestCevapAnahtari | null = null;
  loading = false;
  success: string | null = null;
  error: string | null = null;

  newTest: TestCevapAnahtari = {
    test_adi: '',
    test_aciklamasi: '',
    ogretmen_id: 0,
    soru_sayisi: 10,
    cevaplar: {}
  };

  cevapSecenekleri = ['A', 'B', 'C', 'D', 'E'];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadOgretmenBilgileri();
    this.loadTestler();
  }

  loadOgretmenBilgileri(): void {
    const userData = localStorage.getItem('userData');
    if (userData) {
      const user = JSON.parse(userData);
      this.newTest.ogretmen_id = user.id;
    }
  }

  loadTestler(): void {
    this.loading = true;
    this.http.get<any>(`./server/api/test_cevap_anahtari_yonetimi.php?ogretmen_id=${this.newTest.ogretmen_id}`).subscribe({
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

  toggleAddForm(): void {
    this.showAddForm = !this.showAddForm;
    if (!this.showAddForm) {
      this.resetForm();
    }
  }

  resetForm(): void {
    this.newTest = {
      test_adi: '',
      test_aciklamasi: '',
      ogretmen_id: this.newTest.ogretmen_id,
      soru_sayisi: 10,
      cevaplar: {}
    };
    this.editingTest = null;
    this.generateCevaplar();
  }

  generateCevaplar(): void {
    this.newTest.cevaplar = {};
    for (let i = 1; i <= this.newTest.soru_sayisi; i++) {
      this.newTest.cevaplar[i] = 'A';
    }
  }

  onSoruSayisiChange(): void {
    this.generateCevaplar();
  }

  saveTest(): void {
    if (!this.newTest.test_adi.trim()) {
      this.error = 'Test adı gereklidir';
      return;
    }

    this.loading = true;
    const url = './server/api/test_cevap_anahtari_yonetimi.php';
    const method = this.editingTest ? 'PUT' : 'POST';
    
    const testData = { ...this.newTest };
    if (this.editingTest) {
      testData.id = this.editingTest.id;
    }

    const request = method === 'PUT' 
      ? this.http.put<any>(url, testData)
      : this.http.post<any>(url, testData);

    request.subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success) {
          this.success = response.message;
          this.showAddForm = false;
          this.resetForm();
          this.loadTestler();
        } else {
          this.error = response.message;
        }
      },
      error: (error) => {
        this.loading = false;
        this.error = 'Test kaydedilirken hata oluştu: ' + error.message;
      }
    });
  }

  editTest(test: TestCevapAnahtari): void {
    this.editingTest = test;
    this.newTest = {
      test_adi: test.test_adi,
      test_aciklamasi: test.test_aciklamasi || '',
      ogretmen_id: test.ogretmen_id,
      soru_sayisi: test.soru_sayisi,
      cevaplar: { ...test.cevaplar }
    };
    this.showAddForm = true;
  }

  deleteTest(test: TestCevapAnahtari): void {
    if (!confirm('Bu test cevap anahtarını silmek istediğinizden emin misiniz?')) {
      return;
    }

    this.loading = true;
    this.http.request('DELETE', './server/api/test_cevap_anahtari_yonetimi.php', {
      body: { id: test.id }
    }).subscribe({
      next: (response: any) => {
        this.loading = false;
        if (response.success) {
          this.success = response.message;
          this.loadTestler();
        } else {
          this.error = response.message;
        }
      },
      error: (error) => {
        this.loading = false;
        this.error = 'Test silinirken hata oluştu: ' + error.message;
      }
    });
  }

  clearMessages(): void {
    this.success = null;
    this.error = null;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getSoruArray(): number[] {
    return Array.from({ length: this.newTest.soru_sayisi }, (_, i) => i + 1);
  }
}
