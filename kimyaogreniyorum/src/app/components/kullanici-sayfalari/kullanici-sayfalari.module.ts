import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KullaniciNavbarSayfasiComponent } from './template/kullanici-navbar-sayfasi/kullanici-navbar-sayfasi.component';
import { KullaniciHeaderSayfasiComponent } from './template/kullanici-header-sayfasi/kullanici-header-sayfasi.component';
import { KullaniciIndexSayfasiComponent } from './template/kullanici-index-sayfasi/kullanici-index-sayfasi.component';
import { KullaniciAnaSayfaSayfasiComponent } from './kullanici-ana-sayfa-sayfasi/kullanici-ana-sayfa-sayfasi.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';



@NgModule({
  declarations: [
    KullaniciNavbarSayfasiComponent,
    KullaniciHeaderSayfasiComponent,
    KullaniciIndexSayfasiComponent,
    KullaniciAnaSayfaSayfasiComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
    SharedModule,
  ]
})
export class KullaniciSayfalariModule { }
