import { NgModule, isDevMode } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';

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
import { SharedModule } from './shared/shared.module';
// import { ServiceWorkerModule } from '@angular/service-worker';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    RouterModule,
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
    OgrenciSayfasiModule,
    SharedModule
    // ServiceWorkerModule.register('ngsw-worker.js', {
    //   enabled: !isDevMode(),
    //   registrationStrategy: 'registerWhenStable:30000'
    // })
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}