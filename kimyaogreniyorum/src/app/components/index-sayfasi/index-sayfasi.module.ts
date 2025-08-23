import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from '../../app-routing.module';
import { OgrenciKayitSayfasiComponent } from './giris-kayit-islemeleri/ogrenci-kayit-sayfasi/ogrenci-kayit-sayfasi.component';
import { OgrenciGirisSayfasiComponent } from './giris-kayit-islemeleri/ogrenci-giris-sayfasi/ogrenci-giris-sayfasi.component';
import { OgrenciOnaySayfasiComponent } from './giris-kayit-islemeleri/ogrenci-onay-sayfasi/ogrenci-onay-sayfasi.component';
import { AnasayafaSayfasiComponent } from './anasayafa-sayfasi/anasayafa-sayfasi.component';
import { IndexHeaderSayfasiComponent } from './template/index-header-sayfasi/index-header-sayfasi.component';
import { IndexIndexSayfasiComponent } from './template/index-index-sayfasi/index-index-sayfasi.component';
import { IndexNavbarSayfasiComponent } from './template/index-navbar-sayfasi/index-navbar-sayfasi.component';
import { IndexSidebarSayfasiComponent } from './template/index-sidebar-sayfasi/index-sidebar-sayfasi.component';
import { RouterModule } from '@angular/router';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { IndexIletisimSayfasiComponent } from './index-iletisim-sayfasi/index-iletisim-sayfasi.component';



@NgModule({
  declarations: [
    OgrenciKayitSayfasiComponent,
    OgrenciGirisSayfasiComponent,
    OgrenciOnaySayfasiComponent,
    AnasayafaSayfasiComponent,
    IndexHeaderSayfasiComponent,
    IndexIndexSayfasiComponent,
    IndexNavbarSayfasiComponent,
    IndexSidebarSayfasiComponent,
    IndexIletisimSayfasiComponent,
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    HttpClientModule,
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    RouterModule,
    BrowserAnimationsModule,
  ],
})
export class IndexSayfasiModule {}
