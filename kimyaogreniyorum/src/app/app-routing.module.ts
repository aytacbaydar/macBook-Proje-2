import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { OgrenciGirisSayfasiComponent } from './components/index-sayfasi/giris-kayit-islemeleri/ogrenci-giris-sayfasi/ogrenci-giris-sayfasi.component';
import { OgrenciKayitSayfasiComponent } from './components/index-sayfasi/giris-kayit-islemeleri/ogrenci-kayit-sayfasi/ogrenci-kayit-sayfasi.component';
import { OgrenciOnaySayfasiComponent } from './components/index-sayfasi/giris-kayit-islemeleri/ogrenci-onay-sayfasi/ogrenci-onay-sayfasi.component';
import { YoneticiIndexSayfasiComponent } from './components/yonetici-sayfasi/yonetici-index-sayfasi/yonetici-index-sayfasi.component';
import { OgrenciListesiSayfasiComponent } from './components/yonetici-sayfasi/ogrenci-isleri-sayfasi/ogrenci-listesi-sayfasi/ogrenci-listesi-sayfasi.component';
import { OgrenciDetaySayfasiComponent } from './components/yonetici-sayfasi/ogrenci-isleri-sayfasi/ogrenci-detay-sayfasi/ogrenci-detay-sayfasi.component';
import { KonuAnlatimSayfalariComponent } from './components/yonetici-sayfasi/konu-anlatim-sayfalari/konu-anlatim-sayfalari.component';
import { MysqlSayfasiComponent } from './components/yonetici-sayfasi/mysql-sayfasi/mysql-sayfasi.component';
import { OgrenciGruplarComponent } from './components/yonetici-sayfasi/ogrenci-isleri-sayfasi/ogrenci-gruplar/ogrenci-gruplar.component';
import { OgrenciUcretlerComponent } from './components/yonetici-sayfasi/ogrenci-isleri-sayfasi/ogrenci-ucretler/ogrenci-ucretler.component';
import { GrupDetaySayfasiComponent } from './components/yonetici-sayfasi/ogrenci-isleri-sayfasi/grup-detay-sayfasi/grup-detay-sayfasi.component';
import { OgretmenIndexSayfasiComponent } from './components/ogretmen-sayfasi/ogretmen-index-sayfasi/ogretmen-index-sayfasi.component';
import { OgretmenDersAnlatmaTahtasiComponent } from './components/ogretmen-sayfasi/ogretmen-ders-anlatma-tahtasi/ogretmen-ders-anlatma-tahtasi.component';

const routes: Routes = [
  { path: '', redirectTo: '/giris-sayfasi', pathMatch: 'full' },
  { path: 'giris-sayfasi', component: OgrenciGirisSayfasiComponent },
  { path: 'kayit-sayfasi', component: OgrenciKayitSayfasiComponent },
  { path: 'onay-sayfasi', component: OgrenciOnaySayfasiComponent },

  //yönetici sayfaları
  {
    path: 'yonetici-sayfasi',
    component: YoneticiIndexSayfasiComponent,
    children: [
      {
        path: 'ogrenci-liste-sayfasi',
        component: OgrenciListesiSayfasiComponent,
      },
      {
        path: 'ogrenci-detay-sayfasi/:id',
        component: OgrenciDetaySayfasiComponent,
      },
      {
        path: 'konu-anlatım-sayfasi',
        component: KonuAnlatimSayfalariComponent,
      },
      {
        path: 'mysql-sayfasi',
        component: MysqlSayfasiComponent,
      },
      {
        path: 'ogrenci-gruplar',
        component: OgrenciGruplarComponent,
      },
      {
        path: 'ogrenci-ucretler',
        component: OgrenciUcretlerComponent,
      },
      {
        path: 'grup-detay/:grupAdi',
        component: GrupDetaySayfasiComponent,
      },
    ],
  },

  //öğretmenler sayfaları
  {
    path: 'ogretmen-sayfasi',
    component: OgretmenIndexSayfasiComponent,
    children: [
      {
        path: '',
        component: KonuAnlatimSayfalariComponent,
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
