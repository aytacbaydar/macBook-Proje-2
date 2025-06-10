import { Component } from '@angular/core';

@Component({
  selector: 'app-ogretmen-sidebar-sayfasi',
  standalone: false,
  templateUrl: './ogretmen-sidebar-sayfasi.component.html',
  styleUrl: './ogretmen-sidebar-sayfasi.component.scss',
})
export class OgretmenSidebarSayfasiComponent {
  isClosed = true;

  menuItems = [
    { icon: 'bi-house', label: 'AnaSayfa', link: 'ogretmen-sayfasi' },
    {
      icon: 'bi-journal-plus',
      label: 'Ders Anlatımı',
      link: 'ogretmen-sayfasi/ogretmen-ders-anlatma-tahtasi-sayfasi',
    },
    {
      icon: 'bi-people-fill',
      label: 'Gruplar',
      link: 'ogretmen-sayfasi/ogretmen-gruplar-sayfasi',
    },
    {
      icon: 'bi-camera-reels',
      label: 'Konu Anlatımı',
      link: 'ogretmen-sayfasi/ogretmen-ogrenci-listesi-sayfasi',
    },
    {
      icon: 'bi-pencil-square',
      label: 'Sınavlar',
      link: 'ogretmen-sayfasi/ogretmen-sinavlar-sayfasi',
    },
    { icon: 'bi-archive', label: 'Testler', link: 'ogretmen-sayfasi/' },
    { icon: 'bi-diagram-3', label: 'Yol Haritası', link: 'ogretmen-sayfasi/' },
    {
      icon: 'bi-graph-up-arrow',
      label: 'Konu Analizi',
      link: 'ogretmen-sayfasi/',
    },
    {
      icon: 'bi-filetype-pdf',
      label: 'İşlenen Konular',
      link: 'ogretmen-sayfasi/',
    },
    {
      icon: 'bi-credit-card-2-back',
      label: 'Ücretler',
      link: 'ogretmen-sayfasi/',
    },
    {
      icon: 'bi-clipboard-check',
      label: 'Sınıfta Kimler Var',
      link: 'ogretmen-sayfasi/ogretmen-sinifta-kimler-var-sayfasi',
    },
  ];

  toggleSidebar() {
    this.isClosed = !this.isClosed;
  }
}
