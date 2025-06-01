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
import { OgretmenGruplarSayfasiComponent } from './ogretmen-gruplar-sayfasi/ogretmen-gruplar-sayfasi.component';
import { OgretmenDevamsizlikSayfasiComponent } from './ogretmen-ogrenci-isleri/ogretmen-devamsizlik-sayfasi/ogretmen-devamsizlik-sayfasi.component';
import { OgretmenGruplarDetaySayfasiComponent } from './ogretmen-gruplar-sayfasi/ogretmen-gruplar-detay-sayfasi/ogretmen-gruplar-detay-sayfasi.component';

@NgModule({
  declarations: [
    OgretmenDersAnlatmaTahtasiComponent,
    OgretmenIndexSayfasiComponent,
    OgretmenOgrenciListesiSayfasiComponent,
    OgretmenAnaSayfasiComponent,
    OgretmenGruplarSayfasiComponent,
    OgretmenDevamsizlikSayfasiComponent,
    OgretmenGruplarDetaySayfasiComponent,
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