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
      state('in', style({ opacity: 1, transform: 'translateY(0)' })),
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(30px)' }),
        animate(
          '600ms ease-out',
          style({ opacity: 1, transform: 'translateY(0)' })
        ),
      ]),
    ]),
    trigger('fragmentRotate', [
      state(
        'current',
        style({
          transform: 'rotateX(0deg)',
          opacity: 1,
        })
      ),
      state(
        'transitioning',
        style({
          transform: 'rotateX(90deg)',
          opacity: 0,
        })
      ),
      transition('current => transitioning', [animate('700ms ease-in-out')]),
    ]),
    trigger('fragmentRotateNext', [
      state(
        'hidden',
        style({
          transform: 'rotateX(-90deg)',
          opacity: 0,
        })
      ),
      state(
        'visible',
        style({
          transform: 'rotateX(0deg)',
          opacity: 1,
        })
      ),
      transition('hidden => visible', [animate('700ms 200ms ease-in-out')]),
    ]),
  ],
})
export class IndexHeaderSayfasiComponent implements OnInit, OnDestroy {
  // NodeJS.Timeout hatası için düzeltme
  private autoRotateInterval: any = null;

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
  fragments: Fragment[] = [];
  gridCols = 5;
  gridRows = 5;
  totalSlides: number;

  private touchStartX = 0;
  private touchEndX = 0;
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
  generateFragments(): void {
    this.fragments = [];
    for (let i = 0; i < this.gridCols * this.gridRows; i++) {
      const row = Math.floor(i / this.gridCols);
      const col = i % this.gridCols;

      this.fragments.push({
        index: i,
        row: row,
        col: col,
        delay: col * 0.1,
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

    setTimeout(() => {
      this.currentSlide = (this.currentSlide + 1) % this.totalSlides;
      this.isTransitioning = false;
    }, 1000);
  }
  previousSlide(): void {
    if (this.isTransitioning) return;

    this.isTransitioning = true;

    setTimeout(() => {
      this.currentSlide =
        (this.currentSlide - 1 + this.totalSlides) % this.totalSlides;
      this.isTransitioning = false;
    }, 1000);
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
    this.autoRotateInterval = setInterval(() => {
      this.nextSlide();
    }, 12000);
  }
  stopAutoRotation(): void {
    if (this.autoRotateInterval) {
      clearInterval(this.autoRotateInterval);
      this.autoRotateInterval = null;
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
    return {
      'background-image': `url(${slide.image})`,
      'background-size': `${this.gridCols * 100}% ${this.gridRows * 100}%`,
      'background-position': fragment.currentBackgroundPosition,
    };
  }
}