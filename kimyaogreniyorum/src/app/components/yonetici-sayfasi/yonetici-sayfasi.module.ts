
import { NgModule } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';

// Components
import { YoneticiIndexSayfasiComponent } from './yonetici-index-sayfasi/yonetici-index-sayfasi.component';
import { KonuAnlatimSayfalariComponent } from './konu-anlatim-sayfalari/konu-anlatim-sayfalari.component';
import { MysqlSayfasiComponent } from './mysql-sayfasi/mysql-sayfasi.component';
import { OgrenciListesiSayfasiComponent } from './ogrenci-isleri-sayfasi/ogrenci-listesi-sayfasi/ogrenci-listesi-sayfasi.component';

// Routes
const routes = [
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
        pathMatch: 'full'
      }
    ]
  }
];

@NgModule({
  declarations: [
    YoneticiIndexSayfasiComponent,
    KonuAnlatimSayfalariComponent,
    MysqlSayfasiComponent,
    OgrenciListesiSayfasiComponent
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
