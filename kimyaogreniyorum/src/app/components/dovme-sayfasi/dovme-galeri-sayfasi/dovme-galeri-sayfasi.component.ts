import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-dovme-galeri-sayfasi',
  standalone: false,
  templateUrl: './dovme-galeri-sayfasi.component.html',
  styleUrl: './dovme-galeri-sayfasi.component.scss'
})
export class DovmeGaleriSayfasiComponent implements OnInit {
  selectedCategory = 'all';
  selectedImageIndex = -1;
  isLightboxOpen = false;

  categories = [
    { id: 'all', name: 'Tümü', count: 20 },
    { id: 'siyah-gri', name: 'Siyah & Gri', count: 8 },
    { id: 'renkli', name: 'Renkli', count: 7 },
    { id: 'geometrik', name: 'Geometrik', count: 5 }
  ];

  galleries = [
    {
      id: 1,
      title: 'Kaplan Portresi',
      category: 'siyah-gri',
      image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=800&fit=crop&crop=faces',
      description: 'Detaylı kaplan portresi - siyah gri çalışma'
    },
    {
      id: 2,
      title: 'Gül Desen',
      category: 'renkli',
      image: 'https://images.unsplash.com/photo-1578928465318-b7a5af5c5b7f?w=800&h=800&fit=crop&crop=center',
      description: 'Renkli gül deseni - kırmızı detaylar'
    },
    {
      id: 3,
      title: 'Mandala Çiçek',
      category: 'geometrik',
      image: 'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=800&h=800&fit=crop&crop=center',
      description: 'Simetrik mandala deseni'
    },
    {
      id: 4,
      title: 'Kartal Figürü',
      category: 'siyah-gri',
      image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=800&fit=crop&crop=faces',
      description: 'Güçlü kartal figürü çalışması'
    },
    {
      id: 5,
      title: 'Renkli Kelebek',
      category: 'renkli',
      image: 'https://images.unsplash.com/photo-1580618838477-7dce6ae5b6bf?w=800&h=800&fit=crop&crop=center',
      description: 'Canlı renklerle kelebek deseni'
    },
    {
      id: 6,
      title: 'Üçgen Kompozisyon',
      category: 'geometrik',
      image: 'https://images.unsplash.com/photo-1578928465318-b7a5af5c5b7f?w=800&h=800&fit=crop&crop=center',
      description: 'Modern geometrik tasarım'
    },
    {
      id: 7,
      title: 'Aslan Başı',
      category: 'siyah-gri',
      image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=800&fit=crop&crop=faces',
      description: 'Realistik aslan başı portresi'
    },
    {
      id: 8,
      title: 'Phoenix',
      category: 'renkli',
      image: 'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=800&h=800&fit=crop&crop=center',
      description: 'Ateş kuşu Phoenix deseni'
    },
    {
      id: 9,
      title: 'Aztec Deseni',
      category: 'geometrik',
      image: 'https://images.unsplash.com/photo-1578928465318-b7a5af5c5b7f?w=800&h=800&fit=crop&crop=center',
      description: 'Aztec kültürü geometrik desen'
    },
    {
      id: 10,
      title: 'Geyik Portresi',
      category: 'siyah-gri',
      image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=800&fit=crop&crop=faces',
      description: 'Zarif geyik portresi çalışması'
    },
    {
      id: 11,
      title: 'Ejder Figürü',
      category: 'renkli',
      image: 'https://images.unsplash.com/photo-1580618838477-7dce6ae5b6bf?w=800&h=800&fit=crop&crop=center',
      description: 'Renkli ejder tasarımı'
    },
    {
      id: 12,
      title: 'Hexagon Pattern',
      category: 'geometrik',
      image: 'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=800&h=800&fit=crop&crop=center',
      description: 'Modern hexagon desenler'
    }
  ];

  ngOnInit(): void {}

  get filteredGalleries() {
    if (this.selectedCategory === 'all') {
      return this.galleries;
    }
    return this.galleries.filter(item => item.category === this.selectedCategory);
  }

  selectCategory(categoryId: string): void {
    this.selectedCategory = categoryId;
  }

  openLightbox(index: number): void {
    this.selectedImageIndex = index;
    this.isLightboxOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeLightbox(): void {
    this.isLightboxOpen = false;
    this.selectedImageIndex = -1;
    document.body.style.overflow = 'auto';
  }

  nextImage(): void {
    const filtered = this.filteredGalleries;
    this.selectedImageIndex = (this.selectedImageIndex + 1) % filtered.length;
  }

  prevImage(): void {
    const filtered = this.filteredGalleries;
    this.selectedImageIndex = this.selectedImageIndex === 0 ? filtered.length - 1 : this.selectedImageIndex - 1;
  }

  getCurrentImage() {
    return this.filteredGalleries[this.selectedImageIndex];
  }
}
