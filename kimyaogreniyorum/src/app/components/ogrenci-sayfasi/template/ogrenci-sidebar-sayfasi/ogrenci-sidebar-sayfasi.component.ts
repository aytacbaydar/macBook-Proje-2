import { Component } from '@angular/core';

@Component({
  selector: 'app-ogrenci-sidebar-sayfasi',
  standalone: false,
  templateUrl: './ogrenci-sidebar-sayfasi.component.html',
  styleUrl: './ogrenci-sidebar-sayfasi.component.scss',
})
export class OgrenciSidebarSayfasiComponent {
  isClosed = false;

  menuItems = [
    { icon: 'dashboard', label: 'Dashboard' },
    { icon: 'chat_bubble_outline', label: 'Blog' },
    { icon: 'description', label: 'Sayfalar' },
    { icon: 'group', label: 'Kullanıcılar' },
    { icon: 'exit_to_app', label: 'Çıkış' },
  ];

  toggleSidebar() {
    this.isClosed = !this.isClosed;
  }
}