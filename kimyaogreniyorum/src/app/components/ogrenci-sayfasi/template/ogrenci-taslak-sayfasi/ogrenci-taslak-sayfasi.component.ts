import { Component } from '@angular/core';

@Component({
  selector: 'app-ogrenci-taslak-sayfasi',
  standalone: false,
  templateUrl: './ogrenci-taslak-sayfasi.component.html',
  styleUrl: './ogrenci-taslak-sayfasi.component.scss',
})
export class OgrenciTaslakSayfasiComponent {
  isClosed = true;

  toggleSidebar() {
    this.isClosed = !this.isClosed;
  }
}
