import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-kullanici-header-sayfasi',
  standalone: false,
  templateUrl: './kullanici-header-sayfasi.component.html',
  styleUrl: './kullanici-header-sayfasi.component.scss'
})
export class KullaniciHeaderSayfasiComponent implements OnInit {
  // Modal kontrolleri
  showPdfModal = false;
  showExamDetailModal = false;

  // Alert kontrolleri
  alerts: Alert[] = [];

  // Loading kontrolleri
  isLoading = false;
  loadingMessage = 'Yükleniyor...';

  // Empty state kontrolleri
  showEmptyState = false;
  emptyStateType: 'no-data' | 'no-results' | 'error' | 'success' = 'no-data';
  emptyStateTitle = 'Henüz Veri Yok';
  emptyStateMessage = 'Görünüşe göre henüz hiç kayıt bulunmuyor.';

  // Filter & Search kontrolleri
  searchTerm = '';
  selectedSinavTuru = '';
  selectedDurum = '';
  selectedKonu = '';
  selectedQuickFilter = 'ALL';
  activeFilters: ActiveFilter[] = [];

  // Tabs kontrolleri
  activeTab = 'genel';
  activePillTab = 'tyt';
  activeVerticalTab = 'profil';

  // Dropdown kontrolleri
  activeDropdown: string | null = null;

  // Accordion kontrolleri
  activeAccordion: string | null = null;

  constructor() { }

  ngOnInit(): void {
    // Grafikleri yükle
    setTimeout(() => {
      this.initExamPerformanceChart();
      this.initComparisonChart();
    }, 500);
  }

  // Sınav Performans Grafiği
  initExamPerformanceChart(): void {
    const canvas = document.getElementById('examPerformanceChart') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Chart.js kütüphanesinin yüklü olduğundan emin olun
    if (typeof (window as any).Chart === 'undefined') {
      console.warn('Chart.js kütüphanesi yüklenmemiş');
      return;
    }

    const Chart = (window as any).Chart;

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Deneme 1', 'Deneme 2', 'Deneme 3', 'Deneme 4', 'Deneme 5'],
        datasets: [
          {
            label: 'TYT Başarı Oranı',
            data: [75, 78, 82, 85, 88],
            borderColor: '#667eea',
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 6,
            pointHoverRadius: 8
          },
          {
            label: 'AYT Başarı Oranı',
            data: [70, 73, 76, 79, 83],
            borderColor: '#f6ad55',
            backgroundColor: 'rgba(246, 173, 85, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 6,
            pointHoverRadius: 8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              font: {
                size: 14,
                weight: 'bold'
              },
              padding: 15,
              usePointStyle: true
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleFont: {
              size: 14,
              weight: 'bold'
            },
            bodyFont: {
              size: 13
            },
            callbacks: {
              label: (context: any) => {
                return context.dataset.label + ': ' + context.parsed.y + '%';
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: (value: any) => value + '%',
              font: {
                size: 12
              }
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          },
          x: {
            ticks: {
              font: {
                size: 12
              }
            },
            grid: {
              display: false
            }
          }
        }
      }
    });
  }

  // Karşılaştırma Grafiği
  initComparisonChart(): void {
    const canvas = document.getElementById('comparisonChart') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (typeof (window as any).Chart === 'undefined') {
      console.warn('Chart.js kütüphanesi yüklenmemiş');
      return;
    }

    const Chart = (window as any).Chart;

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs'],
        datasets: [
          {
            label: 'Ortalama Net',
            data: [65, 70, 75, 78, 82],
            backgroundColor: [
              'rgba(102, 126, 234, 0.8)',
              'rgba(246, 173, 85, 0.8)',
              'rgba(72, 187, 120, 0.8)',
              'rgba(237, 100, 166, 0.8)',
              'rgba(99, 102, 241, 0.8)'
            ],
            borderColor: [
              '#667eea',
              '#f6ad55',
              '#48bb78',
              '#ed64a6',
              '#6366f1'
            ],
            borderWidth: 2,
            borderRadius: 8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleFont: {
              size: 14,
              weight: 'bold'
            },
            bodyFont: {
              size: 13
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              font: {
                size: 12
              }
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          },
          x: {
            ticks: {
              font: {
                size: 12
              }
            },
            grid: {
              display: false
            }
          }
        }
      }
    });
  }

  // Modal metodları
  openPdfModal(): void {
    this.showPdfModal = true;
  }

  closePdfModal(): void {
    this.showPdfModal = false;
  }

  openExamDetailModal(): void {
    this.showExamDetailModal = true;
  }

  closeExamDetailModal(): void {
    this.showExamDetailModal = false;
  }

  // Alert metodları
  showAlert(type: 'success' | 'error' | 'warning' | 'info', title: string, message: string): void {
    const alert: Alert = {
      id: Date.now(),
      type,
      title,
      message
    };

    this.alerts.push(alert);

    // 5 saniye sonra otomatik kapat
    setTimeout(() => {
      this.closeAlert(alert.id);
    }, 5000);
  }

  closeAlert(id: number): void {
    this.alerts = this.alerts.filter(alert => alert.id !== id);
  }

  // Örnek kullanım metodları
  testSuccessAlert(): void {
    this.showAlert('success', 'Başarılı!', 'İşlem başarıyla tamamlandı.');
  }

  testErrorAlert(): void {
    this.showAlert('error', 'Hata!', 'Bir hata oluştu, lütfen tekrar deneyin.');
  }

  testWarningAlert(): void {
    this.showAlert('warning', 'Uyarı!', 'Lütfen dikkat edin.');
  }

  testInfoAlert(): void {
    this.showAlert('info', 'Bilgi', 'İşleminiz devam ediyor...');
  }

  // Loading metodları
  showLoading(message: string = 'Yükleniyor...'): void {
    this.isLoading = true;
    this.loadingMessage = message;
  }

  hideLoading(): void {
    this.isLoading = false;
  }

  // Empty State metodları
  showEmpty(type: 'no-data' | 'no-results' | 'error' | 'success', title: string, message: string): void {
    this.showEmptyState = true;
    this.emptyStateType = type;
    this.emptyStateTitle = title;
    this.emptyStateMessage = message;
  }

  hideEmpty(): void {
    this.showEmptyState = false;
  }

  // Örnek veri yükleme simülasyonu
  loadData(): void {
    this.showLoading('Veriler yükleniyor...');

    // API çağrısı simülasyonu
    setTimeout(() => {
      this.hideLoading();

      // Eğer veri yoksa empty state göster
      const hasData = false; // API'den gelen veri kontrolü
      if (!hasData) {
        this.showEmpty('no-data', 'Henüz Veri Yok', 'Görünüşe göre henüz hiç sınav sonucu bulunmuyor.');
      }
    }, 2000);
  }

  // Dropdown metodları
  toggleDropdown(id: string): void {
    this.activeDropdown = this.activeDropdown === id ? null : id;
  }

  // Accordion metodları
  toggleAccordion(id: string): void {
    this.activeAccordion = this.activeAccordion === id ? null : id;
  }
}

interface Alert {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

interface ActiveFilter {
  key: string;
  label: string;
  value: string;
}