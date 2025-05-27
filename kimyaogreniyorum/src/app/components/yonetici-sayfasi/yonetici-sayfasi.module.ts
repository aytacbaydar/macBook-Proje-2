import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { YoneticiIndexSayfasiComponent } from './yonetici-index-sayfasi/yonetici-index-sayfasi.component';
import { KonuAnlatimSayfalariComponent } from './konu-anlatim-sayfalari/konu-anlatim-sayfalari.component';
import { MysqlSayfasiComponent } from './mysql-sayfasi/mysql-sayfasi.component';
import { OgrenciListesiSayfasiComponent } from './ogrenci-isleri-sayfasi/ogrenci-listesi-sayfasi/ogrenci-listesi-sayfasi.component';
import { OgrenciDetaySayfasiComponent } from './ogrenci-isleri-sayfasi/ogrenci-detay-sayfasi/ogrenci-detay-sayfasi.component';
import { OgrenciGruplarComponent } from './ogrenci-isleri-sayfasi/ogrenci-gruplar/ogrenci-gruplar.component';

// Routes
const routes: Routes = [
  {
    path: '',
    component: YoneticiIndexSayfasiComponent,
    children: [
      {
        path: 'ogrenci-listesi-sayfasi',
        component: OgrenciListesiSayfasiComponent
      },
      {
        path: 'konu-anlatim-sayfalari',
        component: KonuAnlatimSayfalariComponent
      },
      {
        path: 'mysql-sayfasi',
        component: MysqlSayfasiComponent
      },
      {
        path: '',
        redirectTo: 'ogrenci-listesi-sayfasi',
        pathMatch: 'full' as const
      }
    ]
  }
];

@NgModule({
  declarations: [
    YoneticiIndexSayfasiComponent,
    KonuAnlatimSayfalariComponent,
    MysqlSayfasiComponent,
    OgrenciListesiSayfasiComponent,
    OgrenciDetaySayfasiComponent,
    OgrenciGruplarComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    HttpClientModule
  ],
  providers: [
    DatePipe
  ],
  exports: [
    YoneticiIndexSayfasiComponent
  ]
})
export class YoneticiSayfasiModule {}