import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DovmeSayfasiIndexSayfasiComponent } from './template/dovme-sayfasi-index-sayfasi/dovme-sayfasi-index-sayfasi.component';
import { DovmeSayfasiNavbarSayfasiComponent } from './template/dovme-sayfasi-navbar-sayfasi/dovme-sayfasi-navbar-sayfasi.component';
import { DovmeSayfasiHeaderSayfasiComponent } from './template/dovme-sayfasi-header-sayfasi/dovme-sayfasi-header-sayfasi.component';
import { DovmeAnaSayfasiComponent } from './dovme-ana-sayfasi/dovme-ana-sayfasi.component';
import { DovmeRandevuSayfasiComponent } from './dovme-randevu-sayfasi/dovme-randevu-sayfasi.component';
import { DovmeGaleriSayfasiComponent } from './dovme-galeri-sayfasi/dovme-galeri-sayfasi.component';



@NgModule({
  declarations: [
    DovmeSayfasiIndexSayfasiComponent,
    DovmeSayfasiNavbarSayfasiComponent,
    DovmeSayfasiHeaderSayfasiComponent,
    DovmeAnaSayfasiComponent,
    DovmeRandevuSayfasiComponent,
    DovmeGaleriSayfasiComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
  ]
})
export class DovmeSayfasiModule { }
