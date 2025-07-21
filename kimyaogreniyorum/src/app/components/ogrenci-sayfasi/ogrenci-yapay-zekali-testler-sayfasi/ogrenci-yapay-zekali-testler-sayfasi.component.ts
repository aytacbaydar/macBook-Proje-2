
import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface StudentInfo {
  id: number;
  adi_soyadi: string;
  email: string;
  sinifi: string;
  grup?: string;
  grubu?: string;
}

interface KonuAnalizi {
  konu_adi: string;
  basari_orani: number;
  dogru_sayisi: number;
  toplam_soru: number;
}

interface TestSoru {
  id: number;
  konu_adi: string;
  sinif_seviyesi: string;
  zorluk_derecesi: string;
  soru_metni: string;
  secenekler: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  dogru_cevap: string;
  test_tipi: string;
}

interface Test {
  id: string;
  sorular: TestSoru[];
  olusturma_tarihi: string;
  toplam_soru: number;
}

@Component({
  selector: 'app-ogrenci-yapay-zekali-testler-sayfasi',
  standalone: false,
  templateUrl: './ogrenci-yapay-zekali-testler-sayfasi.component.html',
  styleUrl: './ogrenci-yapay-zekali-testler-sayfasi.component.scss'
})
export class OgrenciYapayZekaliTestlerSayfasiComponent implements OnInit {
  studentInfo: StudentInfo | null = null;
  konuAnalizi: KonuAnalizi[] = [];
  
  // Test oluşturma form verileri
  selectedImprovementTopics: string[] = [];
  selectedBestTopics: string[] = [];
  improvementQuestionCount = 5;
  advancedQuestionCount = 3;
  
  // Mevcut test
  currentTest: Test | null = null;
  currentQuestionIndex = 0;
  userAnswers: { [key: number]: string } = {};
  showResults = false;
  testResults: any = null;
  
  // UI state
  loading = false;
  loadingAnalysis = false;
  error: string | null = null;
  success: string | null = null;
  
  // Test oluşturma adımları
  currentStep = 1; // 1: Analiz, 2: Konu seçimi, 3: Test çözme, 4: Sonuçlar
  totalSteps = 4;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadStudentInfo();
    this.loadKonuAnalizi();
  }

  private loadStudentInfo(): void {
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');

    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        this.studentInfo = {
          id: user.id,
          adi_soyadi: user.adi_soyadi || 'Öğrenci',
          email: user.email || '',
          sinifi: user.sinifi || user.sinif || 'Sınıf Bilgisi Yok',
          grup: user.grup || user.grubu || ''
        };
      } catch (error) {
        console.error('Student info loading error:', error);
        this.error = 'Öğrenci bilgileri yüklenemedi';
      }
    } else {
      this.error = 'Öğrenci bilgisi bulunamadı';
    }
  }

  private loadKonuAnalizi(): void {
    if (!this.studentInfo) return;

    this.loadingAnalysis = true;
    this.error = null;

    const ogrenciId = this.studentInfo.id;
    this.http.get<any>(`./server/api/ogrenci_konu_analizi.php?ogrenci_id=${ogrenciId}`).subscribe({
      next: (response) => {
        this.loadingAnalysis = false;
        if (response.success && response.data) {
          this.konuAnalizi = response.data.konu_istatistikleri || [];
        } else {
          this.konuAnalizi = [];
        }
      },
      error: (error) => {
        this.loadingAnalysis = false;
        this.error = 'Konu analizi yüklenirken hata oluştu: ' + (error.error?.message || error.message);
        console.error('Error loading konu analizi:', error);
      }
    });
  }

  // Analiz metodları (mevcut konu analiz sayfasından alınmış)
  getGelistirilmesiGerekenKonular(): KonuAnalizi[] {
    return this.konuAnalizi
      .filter(konu => konu.basari_orani < 60)
      .sort((a, b) => a.basari_orani - b.basari_orani)
      .slice(0, 5);
  }

  getEnIyiKonular(): KonuAnalizi[] {
    return this.konuAnalizi
      .filter(konu => konu.basari_orani > 0)
      .sort((a, b) => b.basari_orani - a.basari_orani)
      .slice(0, 5);
  }

  getKonuSuccessColor(basariOrani: number): string {
    if (basariOrani >= 80) return '#28a745';
    if (basariOrani >= 60) return '#ffc107';
    if (basariOrani >= 40) return '#fd7e14';
    return '#dc3545';
  }

  getKonuSuccessText(basariOrani: number): string {
    if (basariOrani >= 80) return 'Mükemmel';
    if (basariOrani >= 60) return 'İyi';
    if (basariOrani >= 40) return 'Orta';
    return 'Geliştirilmeli';
  }

  // Konu seçimi metodları
  toggleImprovementTopic(konuAdi: string): void {
    const index = this.selectedImprovementTopics.indexOf(konuAdi);
    if (index > -1) {
      this.selectedImprovementTopics.splice(index, 1);
    } else {
      this.selectedImprovementTopics.push(konuAdi);
    }
  }

  toggleBestTopic(konuAdi: string): void {
    const index = this.selectedBestTopics.indexOf(konuAdi);
    if (index > -1) {
      this.selectedBestTopics.splice(index, 1);
    } else {
      this.selectedBestTopics.push(konuAdi);
    }
  }

  isImprovementTopicSelected(konuAdi: string): boolean {
    return this.selectedImprovementTopics.includes(konuAdi);
  }

  isBestTopicSelected(konuAdi: string): boolean {
    return this.selectedBestTopics.includes(konuAdi);
  }

  // Test oluşturma
  createTest(): void {
    if (!this.studentInfo) return;

    if (this.selectedImprovementTopics.length === 0 && this.selectedBestTopics.length === 0) {
      this.error = 'En az bir konu seçmelisiniz';
      return;
    }

    this.loading = true;
    this.error = null;

    const testData = {
      ogrenci_id: this.studentInfo.id,
      gelistirilmesi_gereken_konular: this.selectedImprovementTopics,
      en_iyi_konular: this.selectedBestTopics,
      kolay_soru_sayisi: this.improvementQuestionCount,
      zor_soru_sayisi: this.advancedQuestionCount
    };

    this.http.post<any>('./server/api/yapay_zeka_test_olustur.php', testData).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success) {
          this.currentTest = {
            id: response.test_id,
            sorular: response.sorular,
            olusturma_tarihi: new Date().toISOString(),
            toplam_soru: response.toplam_soru
          };
          this.currentQuestionIndex = 0;
          this.userAnswers = {};
          this.currentStep = 3;
          this.success = 'Test başarıyla oluşturuldu!';
        } else {
          this.error = response.message || 'Test oluşturulamadı';
        }
      },
      error: (error) => {
        this.loading = false;
        this.error = 'Test oluşturulurken hata oluştu: ' + (error.error?.message || error.message);
      }
    });
  }

  // Test çözme metodları
  selectAnswer(questionIndex: number, answer: string): void {
    this.userAnswers[questionIndex] = answer;
  }

  nextQuestion(): void {
    if (this.currentTest && this.currentQuestionIndex < this.currentTest.sorular.length - 1) {
      this.currentQuestionIndex++;
    }
  }

  previousQuestion(): void {
    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
    }
  }

  goToQuestion(index: number): void {
    this.currentQuestionIndex = index;
  }

  finishTest(): void {
    if (!this.currentTest) return;

    // Sonuçları hesapla
    let correctAnswers = 0;
    const results: any[] = [];

    this.currentTest.sorular.forEach((soru, index) => {
      const userAnswer = this.userAnswers[index];
      const isCorrect = userAnswer === soru.dogru_cevap;
      
      if (isCorrect) {
        correctAnswers++;
      }

      results.push({
        soru_index: index,
        soru: soru,
        user_answer: userAnswer,
        correct_answer: soru.dogru_cevap,
        is_correct: isCorrect
      });
    });

    this.testResults = {
      totalQuestions: this.currentTest.sorular.length,
      correctAnswers: correctAnswers,
      incorrectAnswers: this.currentTest.sorular.length - correctAnswers,
      score: Math.round((correctAnswers / this.currentTest.sorular.length) * 100),
      details: results
    };

    this.showResults = true;
    this.currentStep = 4;
  }

  // PDF oluşturma
  generatePDF(): void {
    if (!this.currentTest) return;

    this.loading = true;
    
    this.http.get<any>(`./server/api/yapay_zeka_test_pdf.php?test_id=${this.currentTest.id}`).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success) {
          // HTML içeriğini yeni pencerede aç
          const newWindow = window.open('', '_blank');
          if (newWindow) {
            newWindow.document.write(response.html_content);
            newWindow.document.close();
            // Print dialog'u aç
            setTimeout(() => {
              newWindow.print();
            }, 500);
          }
        } else {
          this.error = 'PDF oluşturulamadı';
        }
      },
      error: (error) => {
        this.loading = false;
        this.error = 'PDF oluşturulurken hata oluştu: ' + (error.error?.message || error.message);
      }
    });
  }

  // Sayfa navigasyonu
  goToStep(step: number): void {
    this.currentStep = step;
  }

  resetTest(): void {
    this.currentTest = null;
    this.currentQuestionIndex = 0;
    this.userAnswers = {};
    this.showResults = false;
    this.testResults = null;
    this.selectedImprovementTopics = [];
    this.selectedBestTopics = [];
    this.currentStep = 1;
    this.error = null;
    this.success = null;
  }

  // Yardımcı metodlar
  getAnsweredQuestionsCount(): number {
    return Object.keys(this.userAnswers).length;
  }

  isTestCompleted(): boolean {
    return this.currentTest ? this.getAnsweredQuestionsCount() === this.currentTest.sorular.length : false;
  }

  getProgressPercentage(): number {
    if (!this.currentTest) return 0;
    return Math.round((this.getAnsweredQuestionsCount() / this.currentTest.sorular.length) * 100);
  }

  clearMessages(): void {
    this.error = null;
    this.success = null;
  }
}
