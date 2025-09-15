import { Component } from '@angular/core';

@Component({
  selector: 'app-dovme-sayfasi-navbar-sayfasi',
  standalone: false,
  templateUrl: './dovme-sayfasi-navbar-sayfasi.component.html',
  styleUrl: './dovme-sayfasi-navbar-sayfasi.component.scss'
})
export class DovmeSayfasiNavbarSayfasiComponent {
  isMenuOpen = false;

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu(): void {
    this.isMenuOpen = false;
  }
}
