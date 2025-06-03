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
    { icon: 'bi-house', label: 'AnaSayfa', link: 'ogrenci-sayfasi' },
    {
      icon: 'bi-qr-code-scan',
      label: 'QR Kod',
      link: 'ogrenci-sayfasi/ogrenci-qr-kod-sayfasi',
    },
    { icon: 'bi-camera-reels', label: 'Konu Anlatımı' },
    { icon: 'bi-pencil-square', label: 'Sınavlar' },
    { icon: 'bi-archive', label: 'Testler' },
    { icon: 'bi-diagram-3', label: 'Yol Haritası' },
    { icon: 'bi-graph-up-arrow', label: 'Konu Analizi' },
    { icon: 'bi-filetype-pdf', label: 'İşlenen Konular' },
    { icon: 'bi-credit-card-2-back', label: 'Ücretler' },
  ];

  toggleSidebar() {
    this.isClosed = !this.isClosed;
  }
}
