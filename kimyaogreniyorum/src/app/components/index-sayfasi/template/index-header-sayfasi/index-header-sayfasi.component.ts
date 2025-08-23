import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import {
  trigger,
  state,
  style,
  transition,
  animate,
  keyframes,
} from '@angular/animations';
interface Slide {
  id: number;
  title: string;
  subtitle: string;
  buttonText: string;
  image: string;
  alt: string;
}
interface Fragment {
  index: number;
  row: number;
  col: number;
  delay: number;
  currentBackgroundPosition: string;
  nextBackgroundPosition: string;
}

@Component({
  selector: 'app-index-header-sayfasi',
  standalone: false,
  templateUrl: './index-header-sayfasi.component.html',
  styleUrl: './index-header-sayfasi.component.scss',
  animations: [
    trigger('slideContent', [
      transition('* => *', [
        style({ opacity: 0, transform: 'translateY(50px)' }),
        animate(
          '600ms ease-out',
          style({ opacity: 1, transform: 'translateY(0)' })
        ),
      ]),
    ]),
    trigger('fragmentRotate', [
      state('initial', style({ transform: 'rotateY(0deg)', opacity: 1 })),
      state('rotated', style({ transform: 'rotateY(-180deg)', opacity: 0 })),
      transition(
        'initial => rotated',
        animate('{{delay}} 800ms cubic-bezier(0.25, 0.46, 0.45, 0.94)')
      ),
    ]),
    trigger('fragmentRotateNext', [
      state('initial', style({ transform: 'rotateY(180deg)', opacity: 0 })),
      state('rotated', style({ transform: 'rotateY(0deg)', opacity: 1 })),
      transition(
        'initial => rotated',
        animate('{{delay}} 800ms cubic-bezier(0.25, 0.46, 0.45, 0.94)')
      ),
    ]),
  ],
})
export class IndexHeaderSayfasiComponent implements OnInit, OnDestroy {
  // NodeJS.Timeout hatası için düzeltme
  private autoRotateInterval: any = null;
  private isRotationPaused = false;
  private autoRotationDuration = 12000; // 12 saniye

  slides: Slide[] = [
    {
      id: 1,
      title: 'Kimya Öğrenmenin En Kolay Yolu',
      subtitle: 'Interaktif dersler ve uzman öğretmenlerle kimya öğrenin',
      buttonText: 'Hemen Başla',
      image: 'assets/header/header-1.png',
      alt: 'Kimya Laboratuvarı',
    },
    {
      id: 2,
      title: 'Uzman Öğretmenlerden Ders Alın',
      subtitle: 'Alanında uzman öğretmenlerle birebir kimya dersleri',
      buttonText: 'Öğretmenleri Gör',
      image: 'assets/header/header-4.png',
      alt: 'Kimya Öğretmeni',
    },
    {
      id: 3,
      title: 'Online Test ve Sınavlar',
      subtitle: 'Bilginizi ölçün ve gelişiminizi takip edin',
      buttonText: 'Testlere Başla',
      image: 'assets/header/header-3.png',
      alt: 'Online Test',
    },
    {
      id: 4,
      title: 'Laboratuvar Simülasyonları',
      subtitle: 'Sanal laboratuvarda güvenli deneyler yapın',
      buttonText: "Lab'a Git",
      image: 'assets/header/header-2.png',
      alt: 'Laboratuvar Simülasyonu',
    },
    {
      id: 5,
      title: 'Başarı Hikayeleriniz',
      subtitle: 'Öğrencilerimizin başarı hikayelerini keşfedin',
      buttonText: 'Hikayeleri Oku',
      image: 'assets/header/header-22.png',
      alt: 'Başarılı Öğrenciler',
    },
  ];
  currentSlide = 0;
  isTransitioning = false;
  isLoading = true;
  fragments: Fragment[] = [];
  gridCols = 5;
  gridRows = 5;
  totalSlides: number;

  private touchStartX = 0;
  private touchEndX = 0;
  private rotationInterval: any = null;

  constructor() {
    this.totalSlides = this.slides.length;
    this.generateFragments();
  }
  ngOnInit(): void {
    // Yükleme simülasyonu
    setTimeout(() => {
      this.isLoading = false;
      this.startAutoRotation();
    }, 1500);
  }
  ngOnDestroy(): void {
    this.stopAutoRotation();
  }
  @HostListener('document:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') this.previousSlide();
    if (event.key === 'ArrowRight') this.nextSlide();
  }

  // Add this method to enable trackBy for fragments
  trackByFragment(index: number, fragment: any): any {
    return fragment.id || index;
  }

  generateFragments(): void {
    this.fragments = [];
    for (let i = 0; i < this.gridCols * this.gridRows; i++) {
      const row = Math.floor(i / this.gridCols);
      const col = i % this.gridCols;

      // Diagonal pattern için delay hesaplama
      const diagonalDistance = row + col;
      const maxDistance = this.gridRows - 1 + (this.gridCols - 1);
      const normalizedDelay = (diagonalDistance / maxDistance) * 0.8;

      this.fragments.push({
        index: i,
        row: row,
        col: col,
        delay: normalizedDelay,
        currentBackgroundPosition: `${(col / (this.gridCols - 1)) * 100}% ${
          (row / (this.gridRows - 1)) * 100
        }%`,
        nextBackgroundPosition: `${(col / (this.gridCols - 1)) * 100}% ${
          (row / (this.gridRows - 1)) * 100
        }%`,
      });
    }
  }
  getCurrentSlide(): Slide {
    return this.slides[this.currentSlide];
  }
  getNextSlide(): Slide {
    return this.slides[(this.currentSlide + 1) % this.totalSlides];
  }
  nextSlide(): void {
    if (this.isTransitioning) return;

    this.isTransitioning = true;
    const nextIndex = (this.currentSlide + 1) % this.totalSlides;

    // Önce geçişi başlat
    setTimeout(() => {
      this.currentSlide = nextIndex;
    }, 50);

    // Tüm fragmentlerin geçişini tamamlamasını bekle
    setTimeout(() => {
      this.isTransitioning = false;
    }, 1500);
  }
  previousSlide(): void {
    if (this.isTransitioning) return;

    this.isTransitioning = true;
    const prevIndex =
      this.currentSlide === 0 ? this.totalSlides - 1 : this.currentSlide - 1;

    // Önce geçişi başlat
    setTimeout(() => {
      this.currentSlide = prevIndex;
    }, 50);

    // Tüm fragmentlerin geçişini tamamlamasını bekle
    setTimeout(() => {
      this.isTransitioning = false;
    }, 1500);
  }
  goToSlide(slideIndex: number): void {
    if (this.isTransitioning || slideIndex === this.currentSlide) return;

    this.isTransitioning = true;

    setTimeout(() => {
      this.currentSlide = slideIndex;
      this.isTransitioning = false;
    }, 1000);
  }
  startAutoRotation(): void {
    this.rotationInterval = setInterval(() => {
      if (!this.isTransitioning) {
        this.nextSlide();
      }
    }, this.autoRotationDuration);
  }

  stopAutoRotation(): void {
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
      this.rotationInterval = undefined;
    }
  }

  onMouseEnter(): void {
    // Mouse hover'da durmuyor, sürekli devam ediyor
  }

  onMouseLeave(): void {
    // Mouse hover'da durmuyor, sürekli devam ediyor
  }
  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0].screenX;
  }
  onTouchEnd(event: TouchEvent): void {
    this.touchEndX = event.changedTouches[0].screenX;
    const diff = this.touchStartX - this.touchEndX;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        this.nextSlide();
      } else {
        this.previousSlide();
      }
    }
  }
  getFragmentStyle(fragment: Fragment, isNext: boolean = false): any {
    const slide = isNext ? this.getNextSlide() : this.getCurrentSlide();
    
    // Fragment boyutları
    const fragmentWidth = 100 / this.gridCols;
    const fragmentHeight = 100 / this.gridRows;
    
    // Background position hesaplama - ana resmin doğru parçasını göstermek için
    const bgPosX = (fragment.col / (this.gridCols - 1)) * 100;
    const bgPosY = (fragment.row / (this.gridRows - 1)) * 100;
    
    return {
      'background-image': `url(${slide.image})`,
      'background-size': 'cover',
      'background-position': `${bgPosX}% ${bgPosY}%`,
      'background-repeat': 'no-repeat',
      'width': `${fragmentWidth}%`,
      'height': `${fragmentHeight}%`,
      'left': `${fragment.col * fragmentWidth}%`,
      'top': `${fragment.row * fragmentHeight}%`,
    };
  }
}