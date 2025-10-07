import { Component, ViewChild } from '@angular/core';
import { KullaniciSidebarSayfasiComponent } from '../kullanici-sidebar-sayfasi/kullanici-sidebar-sayfasi.component';

@Component({
  selector: 'app-kullanici-index-sayfasi',
  standalone: false,

  templateUrl: './kullanici-index-sayfasi.component.html',
  styleUrl: './kullanici-index-sayfasi.component.scss'
})
export class KullaniciIndexSayfasiComponent {
  @ViewChild('sidebar') sidebar!: KullaniciSidebarSayfasiComponent;

  onSidebarToggle(): void {
    if (this.sidebar) {
      this.sidebar.toggleSidebar();
    }
  }
}