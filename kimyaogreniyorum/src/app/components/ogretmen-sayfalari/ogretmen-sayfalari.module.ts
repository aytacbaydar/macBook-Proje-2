import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
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
  ]
})
export class OgretmenSayfalariModule { }
