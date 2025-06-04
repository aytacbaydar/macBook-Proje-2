import { Component } from '@angular/core';

@Component({
  selector: 'app-ogretmen-taaslak-sayfasi',
  standalone: false,
  templateUrl: './ogretmen-taaslak-sayfasi.component.html',
  styleUrl: './ogretmen-taaslak-sayfasi.component.scss',
})
export class OgretmenTaaslakSayfasiComponent {
  isClosed = true;

  toggleSidebar() {
    this.isClosed = !this.isClosed;
  }
}
