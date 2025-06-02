import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { IndexSayfasiModule } from './components/index-sayfasi/index-sayfasi.module';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ToastrModule } from 'ngx-toastr';
import { NgxSpinnerModule } from 'ngx-spinner';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NgxPaginationModule } from 'ngx-pagination';
import { YoneticiSayfasiModule } from './components/yonetici-sayfasi/yonetici-sayfasi.module';
import { OgretmenSayfasiModule } from './components/ogretmen-sayfasi/ogretmen-sayfasi.module';
import { OgrenciSayfasiModule } from './components/ogrenci-sayfasi/ogrenci-sayfasi.module';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    ToastrModule.forRoot({
      closeButton: true,
      progressBar: true,
      positionClass: 'toast-bottom-right',
    }),
    NgxSpinnerModule,
    NgxPaginationModule,

    IndexSayfasiModule,
    YoneticiSayfasiModule,
    OgretmenSayfasiModule,
    OgrenciSayfasiModule
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
