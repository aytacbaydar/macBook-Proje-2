import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { HttpClient } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';

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

interface Konu {
  id: number;
  konu_adi: string;
  sinif_seviyesi: string;
  unite_adi?: string;
}

interface TestSoru {
  id: number;
  soru_metni: string;
  soru_aciklamasi?: string;
  soru_resmi?: string;
  secenekler: string;
  dogru_cevap: string;
  zorluk_derecesi: string;
  konu_adi: string;
}

interface Test {
  id: string;
  test_adi?: string;
  sorular: TestSoru[];
  olusturma_tarihi: string;
  toplam_soru: number;
}

@Component({
  selector: 'app-ogrenci-yapay-zekali-testler-sayfasi',
  standalone: false,
  templateUrl: './ogrenci-yapay-zekali-testler-sayfasi.component.html',
  styleUrl: './ogrenci-yapay-zekali-testler-sayfasi.component.scss',
  animations: [
    trigger('slideToggle', [
      state('void', style({ height: '0px', overflow: 'hidden' })),
      state('*', style({ height: '*', overflow: 'visible' })),
      transition('void <=> *', animate('300ms ease-in-out'))
    ])
  ]
})
export class OgrenciYapayZekaliTestlerSayfasiComponent implements OnInit {
  studentInfo: StudentInfo | null = null;
  konuAnalizi: KonuAnalizi[] = [];

  // Test oluşturma form verileri
  selectedImprovementTopics: string[] = [];
  selectedBestTopics: string[] = [];
  selectedOtherTopics: string[] = [];
  improvementQuestionCount = 8;
  advancedQuestionCount = 4;
  challengeQuestionCount = 4;

  // Diğer konular
  tumKonular: Konu[] = [];
  loadingKonular = false;

  // Soru zorluk seviyeleri
  kolayQuestionCount = 15;
  ortaQuestionCount = 15;
  zorQuestionCount = 15;

  // Tek zorluk seviyesi seçim özellikleri
  singleDifficultyMode = false;
  selectedSingleDifficulty = 'kolay';
  totalQuestionCount = 15;

  // Mevcut test
  currentTest: Test | null = null;
  currentQuestionIndex = 0;
  userAnswers: { [key: number]: string } = {};
  showResults = false;
  testResults: any = null;

  // UI variables
  loading = false;
  loadingTestList = false;
  loadingAnalysis = false;
  error: string | null = null;
  success: string | null = null;

  // Test timing
  remainingTime = 0;
  testTimer: any = null;

  // Math object for template
  Math = Math;
  showQuestionDetails: boolean = true;

  // Test oluşturma adımları
  currentStep = 1; // 1: Test listesi, 2: Analiz, 3: Konu seçimi, 4: Test çözme, 5: Sonuçlar
  totalSteps = 5;

  // Test listesi
  testListesi: any[] = [];

  // Confirm dialog
  showConfirmDialog = false;
  confirmDialogData = {
    title: 'Onay',
    message: 'Bu işlemi gerçekleştirmek istediğinizden emin misiniz?',
    confirmText: 'Evet',
    cancelText: 'Hayır',
    type: 'warning' as 'warning' | 'danger' | 'info' | 'success',
    action: null as (() => void) | null
  };

  // Template'de kullanılan computed properties
  get improvementTopics(): KonuAnalizi[] {
    return this.getGelistirilmesiGerekenKonular();
  }

  get bestTopics(): KonuAnalizi[] {
    return this.getEnIyiKonular();
  }

  get otherTopics(): Konu[] {
    return this.tumKonular;
  }

  get currentQuestion(): TestSoru | null {
    if (!this.currentTest || !this.currentTest.sorular) return null;
    return this.currentTest.sorular[this.currentQuestionIndex] || null;
  }

  constructor(
    private http: HttpClient, 
    private toaster: ToastrService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadStudentInfo();
    this.loadKonuAnalizi();
    this.loadTestListesi();
    this.loadTumKonular();
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
        console.log('Konu analizi response:', response);

        if (response && response.success && response.data) {
          this.konuAnalizi = response.data.konu_istatistikleri || [];
        } else {
          this.konuAnalizi = [];
          if (response && !response.success) {
            console.warn('Konu analizi başarısız:', response.message);
          }
        }
      },
      error: (error) => {
        this.loadingAnalysis = false;
        this.error = 'Konu analizi yüklenirken hata oluştu: ' + (error.error?.message || error.message);
        console.error('Error loading konu analizi:', error);
      }
    });
  }

  // Test listesi yükleme
  private loadTestListesi(): void {
    if (!this.studentInfo) return;

    this.loadingTestList = true;
    this.error = null;

    this.http.get<any>(`./server/api/ogrenci_testleri_listesi.php?ogrenci_id=${this.studentInfo.id}`).subscribe({
      next: (response) => {
        this.loadingTestList = false;
        console.log('Test listesi response:', response);

        if (response && response.success) {
          this.testListesi = response.data || [];
        } else if (response) {
          this.error = response.message || 'Test listesi yüklenemedi';
        } else {
          this.error = 'Sunucudan geçersiz yanıt alındı';
        }
      },
      error: (error) => {
        this.loadingTestList = false;
        console.error('Test listesi yükleme hatası:', error);
        this.error = 'Test listesi yüklenirken hata oluştu: ' + (error.error?.message || error.message);
      }
    });
  }

  // Tüm konuları yükle
  private loadTumKonular(): void {
    this.loadingKonular = true;

    this.http.get<any>('./server/api/konu_listesi.php').subscribe({
      next: (response) => {
        this.loadingKonular = false;
        console.log('Konu listesi response:', response);

        if (response && response.success && response.konular) {
          this.tumKonular = response.konular;
        } else if (response) {
          this.error = response.message || 'Konular yüklenemedi';
        } else {
          this.error = 'Sunucudan geçersiz yanıt alındı';
        }
      },
      error: (error) => {
        this.loadingKonular = false;
        console.error('Konu listesi yükleme hatası:', error);
        this.error = 'Konular yüklenirken hata oluştu: ' + (error.error?.message || error.message);
      }
    });
  }

  // Analiz metodları
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

  toggleOtherTopic(konuAdi: string): void {
    const index = this.selectedOtherTopics.indexOf(konuAdi);
    if (index > -1) {
      this.selectedOtherTopics.splice(index, 1);
    } else {
      this.selectedOtherTopics.push(konuAdi);
    }
  }

  isImprovementTopicSelected(konuAdi: string): boolean {
    return this.selectedImprovementTopics.includes(konuAdi);
  }

  isBestTopicSelected(konuAdi: string): boolean {
    return this.selectedBestTopics.includes(konuAdi);
  }

  isOtherTopicSelected(konuAdi: string): boolean {
    return this.selectedOtherTopics.includes(konuAdi);
  }

  // Test oluşturma
  createTest(): void {
    if (!this.studentInfo) return;

    if (this.selectedImprovementTopics.length === 0 && 
        this.selectedBestTopics.length === 0 && 
        this.selectedOtherTopics.length === 0) {
      this.error = 'En az bir konu seçmelisiniz';
      return;
    }

    if (this.getTotalQuestionCount() < 1) {
      this.error = 'En az 1 soru seçmelisiniz';
      return;
    }

    this.loading = true;
    this.error = null;

    let kolayCount = this.kolayQuestionCount;
    let ortaCount = this.ortaQuestionCount;
    let zorCount = this.zorQuestionCount;

    if (this.singleDifficultyMode) {
      kolayCount = 0;
      ortaCount = 0;
      zorCount = 0;

      if (this.selectedSingleDifficulty === 'kolay') {
        kolayCount = this.totalQuestionCount;
      } else if (this.selectedSingleDifficulty === 'orta') {
        ortaCount = this.totalQuestionCount;
      } else if (this.selectedSingleDifficulty === 'zor') {
        zorCount = this.totalQuestionCount;
      }
    }

    const testData = {
      ogrenci_id: this.studentInfo.id,
      gelistirilmesi_gereken_konular: this.selectedImprovementTopics,
      en_iyi_konular: this.selectedBestTopics,
      diger_konular: this.selectedOtherTopics,
      kolay_soru_sayisi: kolayCount,
      orta_soru_sayisi: ortaCount,
      zor_soru_sayisi: zorCount,
      single_difficulty_mode: this.singleDifficultyMode,
      selected_single_difficulty: this.selectedSingleDifficulty
    };

    this.http.post<any>('./server/api/yapay_zeka_test_olustur.php', testData).subscribe({
      next: (response) => {
        this.loading = false;

        if (response && (response.success === true || String(response.success) == "true")) {
          this.success = `Test başarıyla oluşturuldu! ${response.toplam_soru || 'Bilinmeyen sayıda'} soruluk test hazır.`;

          setTimeout(() => {
            this.clearMessages();
            this.backToTestList();
          }, 2000);
        } else {
          this.loadTestListesi();
          this.currentStep = 1;
        }
      },
      error: (error) => {
        this.loading = false;
        console.error('Test oluşturma HTTP hatası:', error);
        this.error = 'Test oluşturulurken hata oluştu: ' + (error.error?.message || error.message || 'Bilinmeyen hata');
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

    let correctAnswers = 0;
    let incorrectAnswers = 0;
    let emptyAnswers = 0;
    const results: any[] = [];

    this.currentTest.sorular.forEach((soru, index) => {
      const userAnswer = this.userAnswers[index];
      let isCorrect = false;

      if (!userAnswer) {
        emptyAnswers++;
      } else if (userAnswer === soru.dogru_cevap) {
        correctAnswers++;
        isCorrect = true;
      } else {
        incorrectAnswers++;
      }

      results.push({
        soru_index: index,
        soru: soru,
        user_answer: userAnswer || '',
        correct_answer: soru.dogru_cevap,
        is_correct: isCorrect
      });
    });

    const net = correctAnswers - (incorrectAnswers * 0.25);
    const yuzde = Math.round((correctAnswers / this.currentTest.sorular.length) * 100);

    this.testResults = {
      dogru_sayisi: correctAnswers,
      yanlis_sayisi: incorrectAnswers,
      bos_sayisi: emptyAnswers,
      toplam_soru: this.currentTest.sorular.length,
      net: net,
      yuzde: yuzde,
      details: results
    };

    this.saveTestResults();
    this.showResults = true;
    this.currentStep = 5;
  }

  private saveTestResults(): void {
    if (!this.currentTest || !this.testResults) return;

    const saveData = {
      test_id: this.currentTest.id,
      user_answers: this.userAnswers,
      test_results: this.testResults
    };

    this.http.post<any>('./server/api/yapay_zeka_test_tamamla.php', saveData).subscribe({
      next: (response) => {
        if (response.success) {
          console.log('Test sonuçları başarıyla kaydedildi');
        } else {
          console.error('Test sonuçları kaydedilemedi:', response.message);
        }
      },
      error: (error) => {
        console.error('Test sonuçları kaydetme hatası:', error);
      }
    });
  }

  // Yardımcı metodlar
  getTotalQuestionCount(): number {
    if (this.singleDifficultyMode) {
      return this.totalQuestionCount;
    } else {
      return this.kolayQuestionCount + this.ortaQuestionCount + this.zorQuestionCount;
    }
  }

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

  // Sayfa navigasyonu
  goToStep(step: number): void {
    this.currentStep = step;
  }

  startNewTest(): void {
    this.currentTest = null;
    this.currentQuestionIndex = 0;
    this.userAnswers = {};
    this.showResults = false;
    this.testResults = null;
    this.selectedImprovementTopics = [];
    this.selectedBestTopics = [];
    this.selectedOtherTopics = [];
    this.currentStep = 2;
    this.clearMessages();
    this.cdr.detectChanges();
  }

  backToTestList(): void {
    this.currentTest = null;
    this.currentQuestionIndex = 0;
    this.userAnswers = {};
    this.showResults = false;
    this.testResults = null;
    this.selectedImprovementTopics = [];
    this.selectedBestTopics = [];
    this.selectedOtherTopics = [];
    this.currentStep = 1;
    this.clearMessages();
    this.loadTestListesi();
  }

  clearMessages(): void {
    this.error = null;
    this.success = null;
  }

  // Test devam ettirme
  continueTest(test: any): void {
    if (test.tamamlandi) {
      this.loadCompletedTestResults(test.id);
    } else {
      this.loadTestDetails(test.id);
    }
  }

  private loadTestDetails(testId: string): void {
    this.loading = true;
    this.error = null;

    this.http.get<any>(`./server/api/yapay_zeka_test_detay.php?test_id=${testId}`).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success) {
          this.currentTest = response.test;
          this.currentQuestionIndex = 0;
          this.userAnswers = response.user_answers || {};
          this.currentStep = 4;
          this.showResults = false;
        } else {
          this.error = response.message || 'Test detayları yüklenemedi';
        }
      },
      error: (error) => {
        this.loading = false;
        this.error = 'Test detayları yüklenirken hata oluştu: ' + (error.error?.message || error.message);
      }
    });
  }

  private loadCompletedTestResults(testId: string): void {
    this.loading = true;
    this.error = null;

    this.http.get<any>(`./server/api/yapay_zeka_test_detay.php?test_id=${testId}&completed=true`).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success) {
          this.testResults = {
            dogru_sayisi: response.test_sonuclari?.dogru_sayisi || 0,
            yanlis_sayisi: response.test_sonuclari?.yanlis_sayisi || 0,
            bos_sayisi: response.test_sonuclari?.bos_sayisi || 0,
            toplam_soru: response.test?.sorular?.length || 0,
            net: response.test_sonuclari?.net || 0,
            yuzde: response.test_sonuclari?.yuzde || 0,
            details: []
          };

          if (response.test && response.test.sorular && response.user_answers) {
            this.testResults.details = response.test.sorular.map((soru: any, index: number) => {
              const userAnswer = response.user_answers[index] || '';
              const isCorrect = userAnswer === soru.dogru_cevap;

              return {
                soru_index: index,
                soru: soru,
                user_answer: userAnswer,
                correct_answer: soru.dogru_cevap,
                is_correct: isCorrect
              };
            });
          }

          this.currentStep = 5;
          this.showResults = true;
        } else {
          this.error = response.message || 'Test sonuçları yüklenemedi';
        }
      },
      error: (error) => {
        this.loading = false;
        this.error = 'Test sonuçları yüklenirken hata oluştu: ' + (error.error?.message || error.message);
      }
    });
  }

  // Test silme
  deleteTest(testId: string): void {
    this.confirmDialogData = {
      title: 'Test Silme',
      message: 'Bu testi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
      confirmText: 'Sil',
      cancelText: 'İptal',
      type: 'danger',
      action: () => this.performDeleteTest(testId)
    };
    this.showConfirmDialog = true;
  }

  private performDeleteTest(testId: string): void {
    if (!this.studentInfo) {
      this.error = 'Öğrenci bilgileri bulunamadı';
      return;
    }

    this.loading = true;
    const deleteData = {
      test_id: testId,
      ogrenci_id: this.studentInfo.id
    };

    this.http.request('DELETE', './server/api/yapay_zeka_test_sil.php', { body: deleteData }).subscribe({
      next: (response: any) => {
        this.loading = false;
        if (response.success) {
          this.success = 'Test başarıyla silindi';
          this.loadTestListesi();
          setTimeout(() => this.clearMessages(), 2000);
        } else {
          this.error = response.message || 'Test silinemedi';
        }
      },
      error: (error) => {
        this.loading = false;
        this.error = 'Test silinirken hata oluştu: ' + (error.error?.message || error.message);
      }
    });
  }

  // Confirm dialog metodları
  onConfirmDialogConfirmed(): void {
    this.showConfirmDialog = false;
    if (this.confirmDialogData.action) {
      setTimeout(() => {
        this.confirmDialogData.action!();
      }, 100);
    }
  }

  onConfirmDialogCancelled(): void {
    this.showConfirmDialog = false;

    if (this.confirmDialogData.title === 'Test Oluşturuldu') {
      this.backToTestList();
    }
  }

  // Tarih ve zaman formatlama
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  }

  // Template helper metodları
  getFormattedSecenekler(): { harf: string, metin: string }[] {
    if (!this.currentQuestion || !this.currentQuestion.secenekler) return [];

    const secenekler = this.currentQuestion.secenekler;
    const formattedSecenekler: { harf: string, metin: string }[] = [];

    if (Array.isArray(secenekler)) {
      secenekler.forEach((secenek: string) => {
        if (secenek && secenek.includes(')')) {
          const parts = secenek.split(')');
          const harf = parts[0].trim();
          const metin = parts.slice(1).join(')').trim();
          formattedSecenekler.push({ harf, metin });
        }
      });
    } 
    else if (typeof secenekler === 'object') {
      const harfler = ['A', 'B', 'C', 'D', 'E'];
      harfler.forEach(harf => {
        const seceneklerObj = secenekler as any;
        if (seceneklerObj[harf]) {
          formattedSecenekler.push({ harf, metin: seceneklerObj[harf] });
        }
      });
    }

    return formattedSecenekler;
  }

  getSoruResmiUrl(soru: TestSoru): string {
    if (soru.soru_resmi) {
      return `./uploads/soru_resimleri/${soru.soru_resmi}`;
    }
    return '';
  }

  // PDF işlemleri
  generatePDF(): void {
    if (!this.currentTest) return;

    this.loading = true;

    this.http.get<any>(`./server/api/yapay_zeka_test_pdf.php?test_id=${this.currentTest.id}`).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success) {
          const newWindow = window.open('', '_blank');
          if (newWindow) {
            newWindow.document.write(response.html_content);
            newWindow.document.close();
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

  downloadTestPDF(): void {
    this.generatePDF();
  }

  downloadTestPdfById(testId: string): void {
    this.loading = true;

    this.http.get<any>(`./server/api/yapay_zeka_test_pdf.php?test_id=${testId}`).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success) {
          const newWindow = window.open('', '_blank');
          if (newWindow) {
            newWindow.document.write(response.html_content);
            newWindow.document.close();
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

  downloadCurrentTestPDF(): void {
    if (!this.currentTest) {
      this.error = 'Test bilgileri bulunamadı';
      return;
    }

    this.loading = true;

    this.http.get<any>(`./server/api/yapay_zeka_test_pdf.php?test_id=${this.currentTest.id}`).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success) {
          const newWindow = window.open('', '_blank');
          if (newWindow) {
            newWindow.document.write(response.html_content);
            newWindow.document.close();
            setTimeout(() => {
              newWindow.print();
            }, 500);
          }
        } else {
          this.error = 'PDF oluşturulamadı: ' + (response.message || 'Bilinmeyen hata');
        }
      },
      error: (error) => {
        this.loading = false;
        this.error = 'PDF oluşturulurken hata oluştu: ' + (error.error?.message || error.message);
      }
    });
  }

  // Test sonuçları helper metodları
  toggleQuestionDetails(): void {
    this.showQuestionDetails = !this.showQuestionDetails;
  }

  getQuestionResultClass(detail: any): string {
    if (!detail.user_answer) return 'table-warning';
    return detail.is_correct ? 'table-success' : 'table-danger';
  }

  getDifficultyBadgeClass(zorluk: string): string {
    switch (zorluk) {
      case 'kolay': return 'bg-success';
      case 'orta': return 'bg-warning';
      case 'zor': return 'bg-danger';
      default: return 'bg-secondary';
    }
  }

  getUserAnswerBadgeClass(detail: any): string {
    if (!detail.user_answer) return 'bg-warning';
    return detail.is_correct ? 'bg-success' : 'bg-danger';
  }

  getStatusBadgeClass(detail: any): string {
    if (!detail.user_answer) return 'bg-warning';
    return detail.is_correct ? 'bg-success' : 'bg-danger';
  }

  getStatusIcon(detail: any): string {
    if (!detail.user_answer) return 'bi bi-circle';
    return detail.is_correct ? 'bi bi-check-circle' : 'bi bi-x-circle';
  }

  getStatusText(detail: any): string {
    if (!detail.user_answer) return 'BOŞ';
    return detail.is_correct ? 'DOĞRU' : 'YANLIŞ';
  }

  getQuestionPreview(soruMetni: string): string {
    if (!soruMetni) return 'Soru metni bulunamadı';
    return soruMetni.length > 50 ? soruMetni.substring(0, 50) + '...' : soruMetni;
  }

  getCorrectQuestionsCount(): number {
    if (!this.testResults || !this.testResults.details) return 0;
    return this.testResults.details.filter((detail: any) => detail.is_correct).length;
  }

  getIncorrectQuestionsCount(): number {
    if (!this.testResults || !this.testResults.details) return 0;
    return this.testResults.details.filter((detail: any) => detail.user_answer && !detail.is_correct).length;
  }

  getEmptyQuestionsCount(): number {
    if (!this.testResults || !this.testResults.details) return 0;
    return this.testResults.details.filter((detail: any) => !detail.user_answer).length;
  }

  createNewTestFromResults(): void {
    this.currentTest = null;
    this.currentQuestionIndex = 0;
    this.userAnswers = {};
    this.showResults = false;
    this.testResults = null;
    this.selectedImprovementTopics = [];
    this.selectedBestTopics = [];
    this.selectedOtherTopics = [];
    this.currentStep = 2;
    this.clearMessages();
    this.cdr.detectChanges();
  }
}