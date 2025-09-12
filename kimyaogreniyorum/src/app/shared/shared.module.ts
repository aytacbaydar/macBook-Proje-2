
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmDialogComponent } from './confirm-dialog/confirm-dialog.component';
import { MobileAppDownloadAlertComponent } from './components/mobile-app-download-alert/mobile-app-download-alert.component';

@NgModule({
  declarations: [
    ConfirmDialogComponent,
    MobileAppDownloadAlertComponent
  ],
  imports: [
    CommonModule
  ],
  exports: [
    ConfirmDialogComponent,
    MobileAppDownloadAlertComponent
  ]
})
export class SharedModule { }
