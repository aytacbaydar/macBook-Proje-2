import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import {
  trigger,
  state,
  style,
  transition,
  animate,
  keyframes,
} from '@angular/animations';

// Bu satırı ekleyin
type TimerRef = ReturnType<typeof setInterval>; 
interface Slide {
  id: number;
  title: string;
  subtitle: string;
  buttonText: string;
  image: string;
  alt: string;
}


@Component({
  selector: 'app-index-header-sayfasi',
  standalone: false,
  templateUrl: './index-header-sayfasi.component.html',
  styleUrl: './index-header-sayfasi.component.scss',
  animations: [
    trigger('slideContent', [
      transition(':enter', [
        style({ transform: 'translateY(30px)', opacity: 0 }),
        animate(
          '600ms ease-out',
          style({ transform: 'translateY(0)', opacity: 1 })
        ),
      ]),
    ]),
    trigger('fragmentRotation', [
      state('current', style({ transform: 'rotateX(0deg)', opacity: 1 })),
      state('exiting', style({ transform: 'rotateX(90deg)', opacity: 0 })),
      state('entering', style({ transform: 'rotateX(0deg)', opacity: 1 })),
      transition('current => exiting', animate('700ms ease-in-out')),
      transition('exiting => entering', animate('700ms ease-in-out')),
    ]),
  ],
})
export class IndexHeaderSayfasiComponent implements OnInit, OnDestroy {
  slides: Slide[] = [
    {
      id: 1,
      title: 'İnovasyon ve Tasarım',
      subtitle:
        'İşletmeleri dönüştüren olağanüstü dijital deneyimler yaratıyoruz',
      buttonText: 'Başlayın',
      image:
        'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1920&h=1080',
      alt: 'Modern şehir manzarası',
    },
    {
      id: 2,
      title: 'Yaratıcı Çözümler',
      subtitle: 'En son teknoloji ile hayallerinizi gerçeğe dönüştürüyoruz',
      buttonText: 'Daha Fazla',
      image:
        'https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1920&h=1080',
      alt: 'Yaratıcı çalışma alanı',
    },
    {
      id: 3,
      title: 'Uzman Ekip',
      subtitle: 'Her projede mükemmellik sunan tutkulu profesyoneller',
      buttonText: 'Ekibimizi Tanıyın',
      image:
        'https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1920&h=1080',
      alt: 'Ofiste takım çalışması',
    },
    {
      id: 4,
      title: 'Teknoloji Lideri',
      subtitle: 'Geleceğin teknolojilerini bugünden hayata geçiriyoruz',
      buttonText: 'Keşfedin',
      image:
        'https://images.unsplash.com/photo-1518709268805-4e9042af2176?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1920&h=1080',
      alt: 'Teknoloji ve inovasyon',
    },
    {
      id: 5,
      title: 'Müşteri Odaklı',
      subtitle:
        'Müşteri memnuniyeti odaklı hizmet anlayışımızla fark yaratıyoruz',
      buttonText: 'İletişim',
      image:
        'https://images.unsplash.com/photo-1557804506-669a67965ba0?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1920&h=1080',
      alt: 'Müşteri hizmetleri',
    },
  ];
  currentSlide = 0;
  isTransitioning = false;
  isLoading = true;
  fragments: number[] = [];
  gridCols = 5;
  gridRows = 5;

  // Add this method to your component class
  trackByFragment(index: number, item: any): number {
    return index;
  }

  private autoRotateInterval?: TimerRef;
  private touchStartX = 0;
  constructor() {
    this.fragments = Array.from(
      { length: this.gridCols * this.gridRows },
      (_, i) => i
    );
  }
  ngOnInit(): void {
    // Simulate loading
    setTimeout(() => {
      this.isLoading = false;
      this.startAutoRotation();
    }, 1500);
  }
  ngOnDestroy(): void {
    this.stopAutoRotation();
  }
  get currentSlideData(): Slide {
    return this.slides[this.currentSlide];
  }
  get nextSlideData(): Slide {
    return this.slides[(this.currentSlide + 1) % this.slides.length];
  }
  nextSlide(): void {
    if (this.isTransitioning) return;

    this.isTransitioning = true;

    setTimeout(() => {
      this.currentSlide = (this.currentSlide + 1) % this.slides.length;
      this.isTransitioning = false;
    }, 1000);
  }
  previousSlide(): void {
    if (this.isTransitioning) return;

    this.isTransitioning = true;

    setTimeout(() => {
      this.currentSlide =
        (this.currentSlide - 1 + this.slides.length) % this.slides.length;
      this.isTransitioning = false;
    }, 1000);
  }
  goToSlide(index: number): void {
    if (this.isTransitioning || index === this.currentSlide) return;

    this.isTransitioning = true;

    setTimeout(() => {
      this.currentSlide = index;
      this.isTransitioning = false;
    }, 1000);
  }
  startAutoRotation(): void {
    this.autoRotateInterval = setInterval(() => {
      this.nextSlide();
    }, 8000);
  }
  stopAutoRotation(): void {
    if (this.autoRotateInterval) {
      clearInterval(this.autoRotateInterval);
      this.autoRotateInterval = undefined;
    }
  }
  onMouseEnter(): void {
    this.stopAutoRotation();
  }
  onMouseLeave(): void {
    this.startAutoRotation();
  }
  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0].screenX;
  }
  onTouchEnd(event: TouchEvent): void {
    const touchEndX = event.changedTouches[0].screenX;
    const diff = this.touchStartX - touchEndX;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        this.nextSlide();
      } else {
        this.previousSlide();
      }
    }
  }
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      this.previousSlide();
    } else if (event.key === 'ArrowRight') {
      this.nextSlide();
    }
  }
  getFragmentRow(index: number): number {
    return Math.floor(index / this.gridCols);
  }
  getFragmentCol(index: number): number {
    return index % this.gridCols;
  }
  getFragmentDelay(index: number): number {
    return this.getFragmentCol(index) * 0.1;
  }
  getFragmentBackgroundPosition(row: number, col: number): string {
    const posX = (col / (this.gridCols - 1)) * 100;
    const posY = (row / (this.gridRows - 1)) * 100;
    return `${posX}% ${posY}%`;
  }
  getFragmentBackgroundSize(): string {
    return `${this.gridCols * 100}% ${this.gridRows * 100}%`;
  }
}