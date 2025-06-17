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
import { OgretmenOgrenciListesiSayfasiComponent } from './components/ogretmen-sayfasi/ogretmen-ogrenci-isleri/ogretmen-ogrenci-listesi-sayfasi/ogretmen-ogrenci-listesi-sayfasi.component';
import { OgretmenAnaSayfasiComponent } from './components/ogretmen-sayfasi/ogretmen-ana-sayfasi/ogretmen-ana-sayfasi.component';
import { OgretmenGruplarSayfasiComponent } from './components/ogretmen-sayfasi/ogretmen-gruplar-sayfasi/ogretmen-gruplar-sayfasi.component';
import { OgretmenDevamsizlikSayfasiComponent } from './components/ogretmen-sayfasi/ogretmen-ogrenci-isleri/ogretmen-devamsizlik-sayfasi/ogretmen-devamsizlik-sayfasi.component';
import { OgretmenGruplarDetaySayfasiComponent } from './components/ogretmen-sayfasi/ogretmen-gruplar-sayfasi/ogretmen-gruplar-detay-sayfasi/ogretmen-gruplar-detay-sayfasi.component';
import { OgretmenOgrenciDetaySayfasiComponent } from './components/ogretmen-sayfasi/ogretmen-ogrenci-isleri/ogretmen-ogrenci-detay-sayfasi/ogretmen-ogrenci-detay-sayfasi.component';
import { OgretmenSiniftaKimlerVarSayfasiComponent } from './components/ogretmen-sayfasi/ogretmen-ogrenci-isleri/ogretmen-sinifta-kimler-var-sayfasi/ogretmen-sinifta-kimler-var-sayfasi.component';
import { OgretmenQrGeneratorComponent } from './components/ogretmen-sayfasi/ogretmen-ogrenci-isleri/ogretmen-qr-generator/ogretmen-qr-generator.component';
import { OgrenciIndexSayfasiComponent } from './components/ogrenci-sayfasi/ogrenci-index-sayfasi/ogrenci-index-sayfasi.component';
import { OgrenciAnaSayfasiComponent } from './components/ogrenci-sayfasi/ogrenci-ana-sayfasi/ogrenci-ana-sayfasi.component';
import { OgrenciQrKodSayfasiComponent } from './components/ogrenci-sayfasi/ogrenci-qr-kod-sayfasi/ogrenci-qr-kod-sayfasi.component';
import { OgrenciTaslakSayfasiComponent } from './components/ogrenci-sayfasi/template/ogrenci-taslak-sayfasi/ogrenci-taslak-sayfasi.component';
import { OgretmenTaaslakSayfasiComponent } from './components/ogretmen-sayfasi/template/ogretmen-taaslak-sayfasi/ogretmen-taaslak-sayfasi.component';
import { OgretmenSinavlarSayfasiComponent } from './components/ogretmen-sayfasi/ogretmen-sinavlar-sayfasi/ogretmen-sinavlar-sayfasi.component';
import { OgretmenUcretSayfasiComponent } from './components/ogretmen-sayfasi/ogretmen-ogrenci-isleri/ogretmen-ucret-sayfasi/ogretmen-ucret-sayfasi.component';
import { OgretmenIslenenKonularSayfasiComponent } from './components/ogretmen-sayfasi/ogretmen-islenen-konular-sayfasi/ogretmen-islenen-konular-sayfasi.component';
import { OgretmenKonuIslemleriSayfasiComponent } from './components/ogretmen-sayfasi/ogretmen-islenen-konular-sayfasi/ogretmen-konu-islemleri-sayfasi/ogretmen-konu-islemleri-sayfasi.component';

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
        path: '',
        component: OgrenciListesiSayfasiComponent,
      },
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

  //öğrenci sayfaları
  {
    path: 'ogrenci-sayfasi',
    component: OgrenciTaslakSayfasiComponent,
    children: [
      {
        path: '',
        component: OgrenciAnaSayfasiComponent,
      },
      {
        path: 'ogrenci-qr-kod-sayfasi',
        component: OgrenciQrKodSayfasiComponent,
      },
    ],
  },

  //öğretmenler sayfaları
  {
    path: 'ogretmen-sayfasi',
    component: OgretmenTaaslakSayfasiComponent,
    children: [
      {
        path: '',
        component: OgretmenAnaSayfasiComponent,
      },
      {
        path: 'ogretmen-ogrenci-listesi-sayfasi',
        component: OgretmenOgrenciListesiSayfasiComponent,
      },
      {
        path: 'ogretmen-ogrenci-detay-sayfasi/:id',
        component: OgretmenOgrenciDetaySayfasiComponent,
      },
      {
        path: 'ogretmen-sinifta-kimler-var-sayfasi',
        component: OgretmenSiniftaKimlerVarSayfasiComponent,
      },
      {
        path: 'ogretmen-sinifta-kimler-var-sayfasi/:grupAdi',
        component: OgretmenSiniftaKimlerVarSayfasiComponent,
      },
      {
        path: 'devamsizlik/:grupAdi',
        component: OgretmenDevamsizlikSayfasiComponent,
      },
      {
        path: 'ogretmen-gruplar-sayfasi',
        component: OgretmenGruplarSayfasiComponent,
      },
      {
        path: 'ogretmen-gruplar-detay-sayfasi/:grupAdi',
        component: OgretmenGruplarDetaySayfasiComponent,
      },
      {
        path: 'ogretmen-ders-anlatma-tahtasi-sayfasi',
        component: OgretmenDersAnlatmaTahtasiComponent,
      },
      {
        path: 'ogretmen-islenen-konular-sayfasi',
        component: OgretmenIslenenKonularSayfasiComponent,
      },
      {
        path: 'konular',
        component: OgretmenKonuIslemleriSayfasiComponent,
      },
      {
        path: 'qr-generator',
        component: OgretmenQrGeneratorComponent,
      },
      {
        path: 'ogretmen-sinavlar-sayfasi',
        component: OgretmenSinavlarSayfasiComponent,
      },
      {
        path: 'ogretmen-ucret-sayfasi',
        component: OgretmenUcretSayfasiComponent,
      },
    ],
  },

  //öğrenci sayfaları
  {
    path: 'ogrenci-sayfasi',
    component: OgrenciIndexSayfasiComponent,
    children: [
      {
        path: '',
        component: OgrenciAnaSayfasiComponent,
      },
      {
        path: 'ogrenci-qr-kod-sayfasi',
        component: OgrenciQrKodSayfasiComponent,
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}