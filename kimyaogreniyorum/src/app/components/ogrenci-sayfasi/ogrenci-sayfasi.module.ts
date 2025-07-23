import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';

// Template Components
import { OgrenciTaslakSayfasiComponent } from './template/ogrenci-taslak-sayfasi/ogrenci-taslak-sayfasi.component';
import { OgrenciNavbarSayfasiComponent } from './template/ogrenci-navbar-sayfasi/ogrenci-navbar-sayfasi.component';
import { OgrenciSidebarSayfasiComponent } from './template/ogrenci-sidebar-sayfasi/ogrenci-sidebar-sayfasi.component';

// Main Components
import { OgrenciAnaSayfasiComponent } from './ogrenci-ana-sayfasi/ogrenci-ana-sayfasi.component';
import { OgrenciProfilSayfasiComponent } from './ogrenci-profil-sayfasi/ogrenci-profil-sayfasi.component';
import { OgrenciIslenenKonularSayfasiComponent } from './ogrenci-islenen-konular-sayfasi/ogrenci-islenen-konular-sayfasi.component';
import { OgrenciIslenenKonularPdfSayfasiComponent } from './ogrenci-islenen-konular-sayfasi/ogrenci-islenen-konular-pdf-sayfasi/ogrenci-islenen-konular-pdf-sayfasi.component';
import { OgrenciQrKodSayfasiComponent } from './ogrenci-qr-kod-sayfasi/ogrenci-qr-kod-sayfasi.component';
import { OgrenciKonuAnalizSayfasiComponent } from './ogrenci-konu-analiz-sayfasi/ogrenci-konu-analiz-sayfasi.component';

// Sınav Components
import { OgrenciSinavIslemleriSayfasiComponent } from './ogrenci-sinav-islemleri-sayfasi/ogrenci-sinav-islemleri-sayfasi.component';
import { OgrenciOptikSayfasiComponent } from './ogrenci-sinav-islemleri-sayfasi/ogrenci-optik-sayfasi/ogrenci-optik-sayfasi.component';
import { OgrenciSinavSonuclariSayfasiComponent } from './ogrenci-sinav-islemleri-sayfasi/ogrenci-sinav-sonuclari-sayfasi/ogrenci-sinav-sonuclari-sayfasi.component';

// Other Components
import { OgrenciSoruCozumuSayfasiComponent } from './ogrenci-soru-cozumu-sayfasi/ogrenci-soru-cozumu-sayfasi.component';
import { OgrenciUcretSayfasiComponent } from './ogrenci-ucret-sayfasi/ogrenci-ucret-sayfasi.component';
import { OgrenciYapayZekaliTestlerSayfasiComponent } from './ogrenci-yapay-zekali-testler-sayfasi/ogrenci-yapay-zekali-testler-sayfasi.component';

import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';


@NgModule({
  declarations: [
    OgrenciProfilSayfasiComponent,
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
    OgrenciUcretSayfasiComponent,
    OgrenciYapayZekaliTestlerSayfasiComponent,
    ConfirmDialogComponent,
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
    SharedModule,
  ],
  exports: [
    OgrenciTaslakSayfasiComponent,
    OgrenciNavbarSayfasiComponent,
    OgrenciSidebarSayfasiComponent,
  ],
})
export class OgrenciSayfasiModule { }