import { Component } from '@angular/core';

@Component({
  selector: 'app-ogrenci-sidebar-sayfasi',
  standalone: false,
  templateUrl: './ogrenci-sidebar-sayfasi.component.html',
  styleUrl: './ogrenci-sidebar-sayfasi.component.scss',
})
export class OgrenciSidebarSayfasiComponent {
  isClosed = true;

  menuItems = [
    {
      icon: 'bi-house',
      label: 'AnaSayfa',
      link: 'ogrenci-sayfasi',
    },
    {
      icon: 'bi-qr-code-scan',
      label: 'QR Kod',
      link: 'ogrenci-sayfasi/ogrenci-qr-kod-sayfasi',
    },
    {
      icon: 'bi-camera-reels',
      label: 'Konu Anlatımı Video',
      link: 'ogrenci-sayfasi',
    },
    {
      icon: 'bi-pencil-square',
      label: 'Sınavlar',
      link: 'ogrenci-sayfasi/ogrenci-sinav-islemleri-sayfasi',
    },
    {
      icon: 'bi-archive',
      label: 'Testler',
      link: 'ogrenci-sayfasi/sinav-sonuclari',
    },
    {
      icon: 'bi-diagram-3',
      label: 'Yol Haritası',
      link: 'ogrenci-sayfasi',
    },
    {
      icon: 'bi-graph-up-arrow',
      label: 'Konu Analizi',
      link: 'ogrenci-sayfasi',
    },
    {
      icon: 'bi-filetype-pdf',
      label: 'İşlenen Konular',
      link: 'ogrenci-sayfasi/ogrenci-islene-konular-sayfasi',
    },
    {
      icon: 'bi-credit-card-2-back',
      label: 'Ücretler',
      link: 'ogrenci-sayfasi',
    },
  ];

  toggleSidebar() {
    this.isClosed = !this.isClosed;
  }
}
