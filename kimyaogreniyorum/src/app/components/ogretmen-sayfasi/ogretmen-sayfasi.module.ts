import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { BrowserModule } from '@angular/platform-browser';
import { OgretmenDersAnlatmaTahtasiComponent } from './ogretmen-ders-anlatma-tahtasi/ogretmen-ders-anlatma-tahtasi.component';
import { OgretmenIndexSayfasiComponent } from './ogretmen-index-sayfasi/ogretmen-index-sayfasi.component';
import { RouterModule } from '@angular/router';
import { OgretmenOgrenciListesiSayfasiComponent } from './ogretmen-ogrenci-isleri/ogretmen-ogrenci-listesi-sayfasi/ogretmen-ogrenci-listesi-sayfasi.component';
import { OgretmenAnaSayfasiComponent } from './ogretmen-ana-sayfasi/ogretmen-ana-sayfasi.component';

@NgModule({
  declarations: [
    OgretmenDersAnlatmaTahtasiComponent,
    OgretmenIndexSayfasiComponent,
    OgretmenOgrenciListesiSayfasiComponent,
    OgretmenAnaSayfasiComponent,
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    HttpClientModule,
    BrowserModule,
    FormsModule,
    RouterModule,
  ],
})
export class OgretmenSayfasiModule {}
