import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { AppRoutingModule } from '../../app-routing.module';
import { YoneticiIndexSayfasiComponent } from './yonetici-index-sayfasi/yonetici-index-sayfasi.component';
import { OgrenciDetaySayfasiComponent } from './ogrenci-isleri-sayfasi/ogrenci-detay-sayfasi/ogrenci-detay-sayfasi.component';
import { OgrenciListesiSayfasiComponent } from './ogrenci-isleri-sayfasi/ogrenci-listesi-sayfasi/ogrenci-listesi-sayfasi.component';
import { OgrenciAnalizSayfasiComponent } from './ogrenci-isleri-sayfasi/ogrenci-analiz-sayfasi/ogrenci-analiz-sayfasi.component';
import { KonuAnlatimSayfalariComponent } from './konu-anlatim-sayfalari/konu-anlatim-sayfalari.component';
import { NgIf, NgFor } from '@angular/common';
import { MysqlSayfasiComponent } from './mysql-sayfasi/mysql-sayfasi.component';
import { OgrenciGruplarComponent } from './ogrenci-isleri-sayfasi/ogrenci-gruplar/ogrenci-gruplar.component';
import { OgrenciUcretlerComponent } from './ogrenci-isleri-sayfasi/ogrenci-ucretler/ogrenci-ucretler.component';
import { GrupDetaySayfasiComponent } from './ogrenci-isleri-sayfasi/grup-detay-sayfasi/grup-detay-sayfasi.component';


@NgModule({
  declarations: [
    OgrenciListesiSayfasiComponent,
    OgrenciDetaySayfasiComponent,
    YoneticiIndexSayfasiComponent,
    OgrenciAnalizSayfasiComponent,
    KonuAnlatimSayfalariComponent,
    MysqlSayfasiComponent,
    OgrenciGruplarComponent,
    OgrenciUcretlerComponent,
    GrupDetaySayfasiComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    HttpClientModule,
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    NgIf,
    NgFor,
  ],
  exports: [
    OgrenciListesiSayfasiComponent,
    OgrenciDetaySayfasiComponent,
    YoneticiIndexSayfasiComponent
  ],
})
export class YoneticiSayfasiModule {}