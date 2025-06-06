import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import * as QRCode from 'qrcode';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
    id: 36,
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
    // Format: studentId_action_timestamp_grup
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

  async downloadAsPDF(): Promise<void> {
    try {
      const element = document.querySelector('.qr-generator-container') as HTMLElement;
      if (!element) {
        console.error('QR Generator container bulunamadı');
        return;
      }

      // HTML'i canvas'a çevir
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true
      });

      // PDF oluştur
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');
      
      const imgWidth = 210; // A4 genişliği (mm)
      const pageHeight = 295; // A4 yüksekliği (mm)
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      let position = 0;

      // İlk sayfayı ekle
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Eğer içerik birden fazla sayfaya yayılıyorsa
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // PDF'i indir
      const fileName = `QR_Kodlari_${this.studentData.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

    } catch (error) {
      console.error('PDF oluşturma hatası:', error);
      this.loadError = 'PDF oluşturulamadı: ' + error;
    }
  }
}