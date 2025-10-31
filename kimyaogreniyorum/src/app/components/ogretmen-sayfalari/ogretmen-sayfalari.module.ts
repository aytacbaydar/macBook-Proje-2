import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { OgretmenDevamsizlikSayfasiComponent } from '../ogretmen-sayfasi/ogretmen-ogrenci-isleri/ogretmen-devamsizlik-sayfasi/ogretmen-devamsizlik-sayfasi.component';
import { DersAnlatimTahasiComponent } from './ders-anlatim-tahasi/ders-anlatim-tahasi.component';



@NgModule({
  declarations: [
    DersAnlatimTahasiComponent
  ],
  imports: [
   CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
    SharedModule, 
    OgretmenDevamsizlikSayfasiComponent,
  ]
})
export class OgretmenSayfalariModule { }
