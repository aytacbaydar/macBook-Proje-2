
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
  soru_resmi?: string;
  aciklama?: string;
  secenekler: {
    A: string;
    B: string;
    C: string;
    D: string;
    E?: string;
  } | { [key: string]: string } | string[];
  dogru_cevap: string;
  test_tipi: string;
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
  styleUrl: './ogrenci-yapay-zekali-testler-sayfasi.component.scss'
})
export class OgrenciYapayZekaliTestlerSayfasiComponent implements OnInit {
  studentInfo: StudentInfo | null = null;
  konuAnalizi: KonuAnalizi[] = [];
  
  // Test oluşturma form verileri
  selectedImprovementTopics: string[] = [];
  selectedBestTopics: string[] = [];
  improvementQuestionCount = 8;
  advancedQuestionCount = 4;
  challengeQuestionCount = 4;
  
  // Template'de kullanılan computed properties
  get improvementTopics(): KonuAnalizi[] {
    return this.getGelistirilmesiGerekenKonular();
  }
  
  get bestTopics(): KonuAnalizi[] {
    return this.getEnIyiKonular();
  }
  
  get currentQuestion(): TestSoru | null {
    if (!this.currentTest || !this.currentTest.sorular) return null;
    return this.currentTest.sorular[this.currentQuestionIndex] || null;
  }
  
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
  currentStep = 1; // 1: Test listesi, 2: Analiz, 3: Konu seçimi, 4: Test çözme, 5: Sonuçlar
  totalSteps = 5;
  
  // Test listesi
  testListesi: any[] = [];
  loadingTestList = false;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadStudentInfo();
    this.loadKonuAnalizi();
    this.loadTestListesi();
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
            test_adi: response.test_adi,
            sorular: response.sorular,
            olusturma_tarihi: new Date().toISOString(),
            toplam_soru: response.toplam_soru
          };
          this.currentQuestionIndex = 0;
          this.userAnswers = {};
          this.currentStep = 4;
          this.success = 'Test başarıyla oluşturuldu!';
          
          // 2 saniye sonra mesajı temizle
          setTimeout(() => {
            this.clearMessages();
          }, 2000);
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

    // Net hesaplama (doğru - yanlış/4)
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

    // Test sonuçlarını sunucuya kaydet
    this.saveTestResults();

    this.showResults = true;
    this.currentStep = 5;
  }

  // Test sonuçlarını sunucuya kaydet
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
    console.log('Test reset ediliyor...');
    this.currentTest = null;
    this.currentQuestionIndex = 0;
    this.userAnswers = {};
    this.showResults = false;
    this.testResults = null;
    this.selectedImprovementTopics = [];
    this.selectedBestTopics = [];
    // currentStep'i burada sıfırlamayalım, startNewTest() bunu hallediyor
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

  // Template'de kullanılan PDF indirme metodu
  downloadTestPDF(): void {
    this.generatePDF();
  }

  // Template'de seçenekleri güvenli şekilde almak için helper method
  getOptionText(option: string): string {
    if (!this.currentQuestion || !this.currentQuestion.secenekler) return '';
    const secenekler = this.currentQuestion.secenekler;
    
    // Eğer secenekler bir nesne ise (string indeksli veya A,B,C,D,E formatında)
    if (typeof secenekler === 'object' && !Array.isArray(secenekler)) {
      const seceneklerObj = secenekler as any;
      return seceneklerObj[option] || '';
    }
    
    return '';
  }

  // Seçenekleri formatlamak için yeni metod
  getFormattedSecenekler(): { harf: string, metin: string }[] {
    if (!this.currentQuestion || !this.currentQuestion.secenekler) return [];
    
    const secenekler = this.currentQuestion.secenekler;
    const formattedSecenekler: { harf: string, metin: string }[] = [];
    
    // Eğer secenekler bir dizi ise (sunucudan gelen format)
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
    // Eğer secenekler bir nesne ise
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

  // Mevcut soru için kullanılabilir seçenekleri döndür
  getAvailableOptions(): string[] {
    if (!this.currentQuestion || !this.currentQuestion.secenekler) return [];
    
    const secenekler = this.currentQuestion.secenekler;
    const allOptions = ['A', 'B', 'C', 'D', 'E'];
    const availableOptions: string[] = [];
    
    // Eğer secenekler bir nesne ise (string indeksli veya A,B,C,D,E formatında)
    if (typeof secenekler === 'object' && !Array.isArray(secenekler)) {
      const seceneklerObj = secenekler as any;
      for (const option of allOptions) {
        const optionText = seceneklerObj[option];
        if (optionText && typeof optionText === 'string' && optionText.trim() !== '') {
          availableOptions.push(option);
        }
      }
    }
    // Eğer secenekler bir dizi ise
    else if (Array.isArray(secenekler)) {
      secenekler.forEach((secenek: string) => {
        if (secenek && secenek.includes(')')) {
          const harf = secenek.split(')')[0].trim();
          if (allOptions.includes(harf)) {
            availableOptions.push(harf);
          }
        }
      });
    }
    
    return availableOptions;
  }

  // Soru resmi URL'ini oluştur
  getSoruResmiUrl(soru: TestSoru): string {
    if (soru.soru_resmi) {
      return `./uploads/soru_resimleri/${soru.soru_resmi}`;
    }
    return '';
  }

  // Test silme
  deleteTest(testId: string): void {
    if (!confirm('Bu testi silmek istediğinizden emin misiniz?')) {
      return;
    }

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
          this.loadTestListesi(); // Listeyi yenile
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

  // Test listesi yükleme
  private loadTestListesi(): void {
    if (!this.studentInfo) return;

    this.loadingTestList = true;
    this.error = null;

    this.http.get<any>(`./server/api/ogrenci_testleri_listesi.php?ogrenci_id=${this.studentInfo.id}`).subscribe({
      next: (response) => {
        this.loadingTestList = false;
        if (response.success) {
          this.testListesi = response.data || [];
        } else {
          this.error = response.message || 'Test listesi yüklenemedi';
        }
      },
      error: (error) => {
        this.loadingTestList = false;
        this.error = 'Test listesi yüklenirken hata oluştu: ' + (error.error?.message || error.message);
      }
    });
  }

  // Testi devam ettir veya sonuçlarını görüntüle
  continueTest(test: any): void {
    if (test.tamamlandi) {
      // Test tamamlanmış, sonuçları göster
      this.testResults = {
        dogru_sayisi: test.dogru_sayisi,
        yanlis_sayisi: test.yanlis_sayisi,
        bos_sayisi: test.bos_sayisi,
        toplam_soru: test.toplam_soru,
        net: test.net,
        yuzde: test.yuzde
      };
      this.currentStep = 5;
      this.showResults = true;
    } else {
      // Test devam ettirilebilir, test detaylarını yükle
      this.loadTestDetails(test.id);
    }
  }

  // Test detaylarını yükle
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

  // Test PDF'ini indir
  downloadTestPdfById(testId: string): void {
    this.loading = true;
    
    this.http.get<any>(`./server/api/yapay_zeka_test_pdf.php?test_id=${testId}`).subscribe({
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

  // Yeni test oluşturmaya başla
  startNewTest(): void {
    console.log('Yeni test oluşturma başlatılıyor...');
    this.currentStep = 2;
    this.resetTest();
    console.log('Current step:', this.currentStep);
  }

  // Test listesine geri dön
  backToTestList(): void {
    this.currentStep = 1;
    this.resetTest();
    this.loadTestListesi();
  }

  // Tarih formatlama
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
}
