
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmDialogComponent } from './confirm-dialog/confirm-dialog.component';
import { MobileAppDownloadAlertComponent } from './components/mobile-app-download-alert/mobile-app-download-alert.component';
import { ApkInstallationGuideComponent } from './components/apk-installation-guide/apk-installation-guide.component';

@NgModule({
  declarations: [
    ConfirmDialogComponent,
    MobileAppDownloadAlertComponent,
    ApkInstallationGuideComponent
  ],
  imports: [
    CommonModule
  ],
  exports: [
    ConfirmDialogComponent,
    MobileAppDownloadAlertComponent,
    ApkInstallationGuideComponent
  ]
})
export class SharedModule { }
