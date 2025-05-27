import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-ogrenci-onay-sayfasi',
  standalone: false,

  templateUrl: './ogrenci-onay-sayfasi.component.html',
  styleUrl: './ogrenci-onay-sayfasi.component.scss',
})
export class OgrenciOnaySayfasiComponent implements OnInit {
  constructor(private router: Router) {}

  ngOnInit(): void {
    // Component initialization code
  }

  navigateToLogin(): void {
    this.router.navigate(['/giris-sayfasi']);
  }

  navigateToHome(): void {
    this.router.navigate(['/index-sayfasi']);
  }
}