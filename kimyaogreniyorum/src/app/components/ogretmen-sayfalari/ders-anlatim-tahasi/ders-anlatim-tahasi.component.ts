import { Component, ElementRef, ViewChild } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist/webpack';

@Component({
  selector: 'app-ders-anlatim-tahtasi',
  templateUrl: './ders-anlatim-tahasi.component.html',
  styleUrls: ['./ders-anlatim-tahasi.component.scss'],
  standalone: false,
})
export class DersAnlatimTahasiComponent {
  @ViewChild('pdfCanvas', { static: false }) pdfCanvas?: ElementRef<HTMLCanvasElement>;

  pdfYukleniyor = false;
  pdfHataMesaji = '';
  private readonly pdfWorkerSrc = '/build/pdf.worker.min.mjs';

  constructor() {
    pdfjsLib.GlobalWorkerOptions.workerSrc = this.pdfWorkerSrc;
    console.info('[PDF] Worker yolu ayarlandı:', pdfjsLib.GlobalWorkerOptions.workerSrc);
  }

  async onPdfSec(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    if (!this.pdfCanvas) {
      this.pdfHataMesaji = 'Canvas elementi bulunamadı.';
      console.error('[PDF] Canvas referansı alınamadı.');
      return;
    }

    this.pdfYukleniyor = true;
    this.pdfHataMesaji = '';
    const canvasEl = this.pdfCanvas.nativeElement;
    const ctx = canvasEl.getContext('2d');

    if (!ctx) {
      this.pdfYukleniyor = false;
      this.pdfHataMesaji = 'Canvas bağlamı oluşturulamadı.';
      console.error('[PDF] Canvas 2D context alınamadı.');
      return;
    }

    try {
      console.info('[PDF] Yükleme başladı:', file.name);
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      console.info('[PDF] Belge okundu. Sayfa sayısı:', pdf.numPages);

      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.5 });

      canvasEl.width = viewport.width;
      canvasEl.height = viewport.height;

      await page.render({ canvasContext: ctx, viewport, canvas: canvasEl }).promise;
      console.info('[PDF] İlk sayfa canvas üzerine çizildi.');
    } catch (error) {
      console.error('[PDF] Yükleme sırasında hata oluştu:', error);
      this.pdfHataMesaji = 'PDF yüklenirken bir hata oluştu.';
    } finally {
      this.pdfYukleniyor = false;
    }
  }
}
