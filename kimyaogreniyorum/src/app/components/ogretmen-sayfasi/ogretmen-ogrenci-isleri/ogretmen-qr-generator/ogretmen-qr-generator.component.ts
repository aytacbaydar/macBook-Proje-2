import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import * as QRCode from 'qrcode';

@Component({
  selector: 'app-ogretmen-qr-generator',
  standalone: false,
  templateUrl: './ogretmen-qr-generator.component.html',
  styleUrl: './ogretmen-qr-generator.component.scss'
})
export class OgretmenQrGeneratorComponent implements OnInit, AfterViewInit {
  @ViewChild('entryQRCanvas', { static: false }) entryQRCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('exitQRCanvas', { static: false }) exitQRCanvas!: ElementRef<HTMLCanvasElement>;

  studentData = {
    id: 35,
    name: "Elif Elif",
    email: "elish263624@gmail.com"
  };

  currentDate: string = '';
  entryQRData: string = '';
  exitQRData: string = '';
  isLibraryLoaded: boolean = false;
  loadError: string = '';

  constructor() { }

  ngOnInit(): void {
    this.updateDateTime();
    setInterval(() => this.updateDateTime(), 1000);
  }

  ngAfterViewInit(): void {
    // QRCode kütüphanesi npm ile yüklendiği için direkt kullanabiliriz
    this.isLibraryLoaded = true;
    this.generateQRCodes();
  }

  updateDateTime(): void {
    const now = new Date();
    this.currentDate = now.toLocaleDateString('tr-TR') + ' ' + now.toLocaleTimeString('tr-TR');
  }

  generateQRData(action: string): string {
    const timestamp = Date.now();
    return `${this.studentData.id}_${action}_${timestamp}`;
  }

  generateQRCodes(): void {
    if (!this.isLibraryLoaded) {
      console.error('QRCode kütüphanesi henüz yüklenmedi');
      return;
    }

    try {
      this.entryQRData = this.generateQRData('entry');
      this.exitQRData = this.generateQRData('exit');

      // Giriş QR kodu
      QRCode.toCanvas(this.entryQRCanvas.nativeElement, this.entryQRData, {
        width: 200,
        margin: 2,
        color: {
          dark: '#28a745',
          light: '#FFFFFF'
        }
      }).then(() => {
        console.log('Giriş QR kodu başarıyla oluşturuldu');
      }).catch((error: any) => {
        console.error('Giriş QR kodu oluşturulamadı:', error);
        this.loadError = 'Giriş QR kodu oluşturulamadı';
      });

      // Çıkış QR kodu
      QRCode.toCanvas(this.exitQRCanvas.nativeElement, this.exitQRData, {
        width: 200,
        margin: 2,
        color: {
          dark: '#dc3545',
          light: '#FFFFFF'
        }
      }).then(() => {
        console.log('Çıkış QR kodu başarıyla oluşturuldu');
      }).catch((error: any) => {
        console.error('Çıkış QR kodu oluşturulamadı:', error);
        this.loadError = 'Çıkış QR kodu oluşturulamadı';
      });

    } catch (error) {
      console.error('QR kod oluşturma hatası:', error);
      this.loadError = 'QR kodları oluşturulamadı: ' + error;
    }
  }

  printQRCodes(): void {
    window.print();
  }

  regenerateQRCodes(): void {
    this.loadError = '';
    this.generateQRCodes();
  }
}