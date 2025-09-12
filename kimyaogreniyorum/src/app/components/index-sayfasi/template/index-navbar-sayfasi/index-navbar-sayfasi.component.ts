import { Component } from '@angular/core';

@Component({
  selector: 'app-index-navbar-sayfasi',
  standalone: false,
  templateUrl: './index-navbar-sayfasi.component.html',
  styleUrl: './index-navbar-sayfasi.component.scss'
})
export class IndexNavbarSayfasiComponent {

  openNav() {
    const sidenav = document.getElementById('mySidenav');
    if (sidenav) {
      sidenav.style.width = '280px';
    }
  }

  closeNav() {
    const sidenav = document.getElementById('mySidenav');
    if (sidenav) {
      sidenav.style.width = '0';
    }
  }

}
