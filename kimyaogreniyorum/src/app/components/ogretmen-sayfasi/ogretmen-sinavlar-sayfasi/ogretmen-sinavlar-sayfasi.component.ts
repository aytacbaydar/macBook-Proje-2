
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-ogretmen-sinavlar-sayfasi',
  templateUrl: './ogretmen-sinavlar-sayfasi.component.html',
  styleUrls: ['./ogretmen-sinavlar-sayfasi.component.scss'],
  standalone: false
})
export class OgretmenSinavlarSayfasiComponent implements OnInit {

  constructor(private router: Router) { }

  ngOnInit(): void {
  }

  navigateToCevapAnahtari() {
    this.router.navigate(['/ogretmen-sayfasi/ogretmen-cevap-anahtari-sayfasi']);
  }

  navigateToSinavSonuclari() {
    this.router.navigate(['/ogretmen-sayfasi/ogretmen-ogrenci-sinav-sonuclari-sayfasi']);
  }
}
