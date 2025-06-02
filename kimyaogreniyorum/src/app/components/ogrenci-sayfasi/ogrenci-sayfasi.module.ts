import { NgModule } from '@angular/core';
import { CommonModule, NgIf, NgFor } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { BrowserModule } from '@angular/platform-browser';
import { OgrenciQrKodSayfasiComponent } from './ogrenci-qr-kod-sayfasi/ogrenci-qr-kod-sayfasi.component';
import { OgrenciIndexSayfasiComponent } from './ogrenci-index-sayfasi/ogrenci-index-sayfasi.component';
import { RouterModule } from '@angular/router';
import { OgrenciAnaSayfasiComponent } from './ogrenci-ana-sayfasi/ogrenci-ana-sayfasi.component';



@NgModule({
  declarations: [OgrenciQrKodSayfasiComponent, OgrenciIndexSayfasiComponent, OgrenciAnaSayfasiComponent],
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
