import { NgModule } from '@angular/core';
import { CommonModule, NgIf, NgFor } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { BrowserModule } from '@angular/platform-browser';
import { OgrenciQrKodSayfasiComponent } from './ogrenci-qr-kod-sayfasi/ogrenci-qr-kod-sayfasi.component';
import { RouterModule } from '@angular/router';
import { OgrenciAnaSayfasiComponent } from './ogrenci-ana-sayfasi/ogrenci-ana-sayfasi.component';
import { OgrenciTaslakSayfasiComponent } from './template/ogrenci-taslak-sayfasi/ogrenci-taslak-sayfasi.component';
import { OgrenciNavbarSayfasiComponent } from './template/ogrenci-navbar-sayfasi/ogrenci-navbar-sayfasi.component';
import { OgrenciSidebarSayfasiComponent } from './template/ogrenci-sidebar-sayfasi/ogrenci-sidebar-sayfasi.component';
import { OgrenciIslenenKonularSayfasiComponent } from './ogrenci-islenen-konular-sayfasi/ogrenci-islenen-konular-sayfasi.component';
import { OgrenciIslenenKonularPdfSayfasiComponent } from './ogrenci-islenen-konular-sayfasi/ogrenci-islenen-konular-pdf-sayfasi/ogrenci-islenen-konular-pdf-sayfasi.component';
import { OgrenciSinavIslemleriSayfasiComponent } from './ogrenci-sinav-islemleri-sayfasi/ogrenci-sinav-islemleri-sayfasi.component';
import { OgrenciOptikSayfasiComponent } from './ogrenci-sinav-islemleri-sayfasi/ogrenci-optik-sayfasi/ogrenci-optik-sayfasi.component';
import { OgrenciSinavSonuclariSayfasiComponent } from './ogrenci-sinav-islemleri-sayfasi/ogrenci-sinav-sonuclari-sayfasi/ogrenci-sinav-sonuclari-sayfasi.component';
import { OgrenciKonuAnalizSayfasiComponent } from './ogrenci-konu-analiz-sayfasi/ogrenci-konu-analiz-sayfasi.component';
import { OgrenciSoruCozumuSayfasiComponent } from './ogrenci-soru-cozumu-sayfasi/ogrenci-soru-cozumu-sayfasi.component';

@NgModule({
  declarations: [
    OgrenciQrKodSayfasiComponent,
    OgrenciAnaSayfasiComponent,
    OgrenciTaslakSayfasiComponent,
    OgrenciNavbarSayfasiComponent,
    OgrenciSidebarSayfasiComponent,
    OgrenciIslenenKonularSayfasiComponent,
    OgrenciIslenenKonularPdfSayfasiComponent,
    OgrenciSinavIslemleriSayfasiComponent,
    OgrenciOptikSayfasiComponent,
    OgrenciSinavSonuclariSayfasiComponent,
    OgrenciKonuAnalizSayfasiComponent,
    OgrenciSoruCozumuSayfasiComponent,
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    HttpClientModule,
    BrowserModule,
    FormsModule,
    RouterModule,
    NgIf,
    NgFor,
  ],
})
export class OgrenciSayfasiModule {}
