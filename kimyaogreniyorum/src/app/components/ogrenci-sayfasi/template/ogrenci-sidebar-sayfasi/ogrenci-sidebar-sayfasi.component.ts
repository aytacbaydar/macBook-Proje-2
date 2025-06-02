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
    { icon: 'dashboard', label: 'AnaSayfa', link: 'ogrenci-sayfasi' },
    {
      icon: 'qr_code_scanner',
      label: 'QR Kod',
      link: 'ogrenci-sayfasi/ogrenci-qr-kod-sayfasi',
    },
    { icon: 'description', label: 'Sayfalar' },
    { icon: 'group', label: 'Kullanıcılar' },
    { icon: 'exit_to_app', label: 'Çıkış' },
  ];

  toggleSidebar() {
    this.isClosed = !this.isClosed;
  }
}
