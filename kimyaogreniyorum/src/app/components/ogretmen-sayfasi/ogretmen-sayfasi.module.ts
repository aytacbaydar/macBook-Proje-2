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
import { OgretmenOgrenciDetaySayfasiComponent } from './ogretmen-ogrenci-isleri/ogretmen-ogrenci-detay-sayfasi/ogretmen-ogrenci-detay-sayfasi.component';
import { OgretmenSiniftaKimlerVarSayfasiComponent } from './ogretmen-ogrenci-isleri/ogretmen-sinifta-kimler-var-sayfasi/ogretmen-sinifta-kimler-var-sayfasi.component';
import { OgretmenQrGeneratorComponent } from './ogretmen-ogrenci-isleri/ogretmen-qr-generator/ogretmen-qr-generator.component';
import { OgretmenSidebarSayfasiComponent } from './template/ogretmen-sidebar-sayfasi/ogretmen-sidebar-sayfasi.component';

import { OgretmenNavbarSayfasiComponent } from './template/ogretmen-navbar-sayfasi/ogretmen-navbar-sayfasi.component';
import { OgretmenTaaslakSayfasiComponent } from './template/ogretmen-taaslak-sayfasi/ogretmen-taaslak-sayfasi.component';
import { OgretmenSinavlarSayfasiComponent } from './ogretmen-sinavlar-sayfasi/ogretmen-sinavlar-sayfasi.component';
import { OgretmenUcretSayfasiComponent } from './ogretmen-ogrenci-isleri/ogretmen-ucret-sayfasi/ogretmen-ucret-sayfasi.component';
import { OgretmenIslenenKonularSayfasiComponent } from './ogretmen-islenen-konular-sayfasi/ogretmen-islenen-konular-sayfasi.component';
import { OgretmenKonuIslemleriSayfasiComponent } from './ogretmen-islenen-konular-sayfasi/ogretmen-konu-islemleri-sayfasi/ogretmen-konu-islemleri-sayfasi.component';
import { OgretmenSoruCozumuSayfasiComponent } from './ogretmen-soru-cozumu-sayfasi/ogretmen-soru-cozumu-sayfasi.component';
import { OgretmenEkDersGirisiSayfasiComponent } from './ogretmen-ogrenci-isleri/ogretmen-ek-ders-girisi-sayfasi/ogretmen-ek-ders-girisi-sayfasi.component';

@NgModule({
  declarations: [
    OgretmenDersAnlatmaTahtasiComponent,
    OgretmenIndexSayfasiComponent,
    OgretmenOgrenciListesiSayfasiComponent,
    OgretmenAnaSayfasiComponent,
    OgretmenGruplarSayfasiComponent,
    OgretmenDevamsizlikSayfasiComponent,
    OgretmenGruplarDetaySayfasiComponent,
    OgretmenOgrenciDetaySayfasiComponent,
    OgretmenSiniftaKimlerVarSayfasiComponent,
    OgretmenQrGeneratorComponent,
    OgretmenSidebarSayfasiComponent,
    OgretmenNavbarSayfasiComponent,
    OgretmenTaaslakSayfasiComponent,
    OgretmenSinavlarSayfasiComponent,
    OgretmenUcretSayfasiComponent,
    OgretmenIslenenKonularSayfasiComponent,
    OgretmenKonuIslemleriSayfasiComponent,
    OgretmenSoruCozumuSayfasiComponent,
    OgretmenEkDersGirisiSayfasiComponent,
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