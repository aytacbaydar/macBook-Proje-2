import { Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist/webpack';
import type { DocumentInitParameters, PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';

@Component({
  selector: 'app-ders-anlatim-tahtasi',
  templateUrl: './ders-anlatim-tahasi.component.html',
  styleUrls: ['./ders-anlatim-tahasi.component.scss'],
  standalone: false,
})
export class DersAnlatimTahasiComponent implements OnDestroy {
  @ViewChild('pdfCanvas', { static: false }) pdfCanvas?: ElementRef<HTMLCanvasElement>;

  pdfYukleniyor = false;
  pdfHataMesaji = '';

  currentPage = 0;
  totalPages = 0;

  private workerObjectUrl?: string;
  private workerInstance?: Worker;
  private workerInitPromise?: Promise<boolean>;
  private fallbackToMainThread = false;
  private pdfDoc?: PDFDocumentProxy;
  private renderInProgress = false;
  private pendingPage?: number;
  private readonly renderScale = 1.5;

  constructor() {
    console.info('[PDF::ctor] Component created');
  }

  ngOnDestroy(): void {
    console.info('[PDF::ngOnDestroy] Component destroyed');
    if (this.workerObjectUrl) {
      console.info('[PDF::ngOnDestroy] Revoking worker blob URL', this.workerObjectUrl);
      URL.revokeObjectURL(this.workerObjectUrl);
      this.workerObjectUrl = undefined;
    }
    if (this.workerInstance) {
      console.info('[PDF::ngOnDestroy] Terminating worker');
      this.workerInstance.terminate();
      this.workerInstance = undefined;
      pdfjsLib.GlobalWorkerOptions.workerPort = undefined as unknown as Worker;
    }
    this.pdfDoc = undefined;
  }

  async onPdfSec(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    console.info('[PDF::onPdfSec] File selection event', input.files?.[0]?.name);
    const file = input.files?.[0];

    if (!file) {
      console.warn('[PDF::onPdfSec] No file selected');
      return;
    }

    this.pdfDoc = undefined;
    this.totalPages = 0;
    this.currentPage = 0;
    this.pendingPage = undefined;
    this.pdfYukleniyor = true;
    this.pdfHataMesaji = '';

    try {
      const workerReady = await this.ensureWorker();
      console.info('[PDF::onPdfSec] Worker status', { workerReady, fallback: this.fallbackToMainThread });

      const buffer = await file.arrayBuffer();
      console.info('[PDF::onPdfSec] File buffer length', buffer.byteLength);
      const params: DocumentInitParameters & { disableWorker?: boolean } = {
        data: buffer,
      };
      if (!workerReady) {
        params.disableWorker = true;
        console.info('[PDF::onPdfSec] Worker disabled, main-thread mode');
      }

      const loadingTask = pdfjsLib.getDocument(params);
      console.info('[PDF::onPdfSec] getDocument called');
      const pdf = await loadingTask.promise;
      console.info('[PDF::onPdfSec] PDF loaded, total pages', pdf.numPages);

      this.pdfDoc = pdf;
      this.totalPages = pdf.numPages;
      await this.renderPage(1);
    } catch (error) {
      console.error('[PDF::onPdfSec] Error while loading PDF', error);
      this.pdfHataMesaji = 'PDF yuklenirken bir hata olustu.';
    } finally {
      this.pdfYukleniyor = false;
      input.value = '';
      console.info('[PDF::onPdfSec] Operation finished');
    }
  }

  async oncekiSayfa(): Promise<void> {
    if (!this.pdfDoc) {
      console.warn('[PDF::oncekiSayfa] No PDF document');
      return;
    }
    if (this.currentPage <= 1) {
      console.warn('[PDF::oncekiSayfa] Already at first page');
      return;
    }
    const target = this.currentPage - 1;
    console.info('[PDF::oncekiSayfa] Target page', target);
    await this.renderPage(target);
  }

  async sonrakiSayfa(): Promise<void> {
    if (!this.pdfDoc) {
      console.warn('[PDF::sonrakiSayfa] No PDF document');
      return;
    }
    if (this.currentPage >= this.totalPages) {
      console.warn('[PDF::sonrakiSayfa] Already at last page');
      return;
    }
    const target = this.currentPage + 1;
    console.info('[PDF::sonrakiSayfa] Target page', target);
    await this.renderPage(target);
  }

  private async renderPage(pageNumber: number): Promise<void> {
    if (!this.pdfDoc) {
      console.warn('[PDF::renderPage] PDF document missing');
      return;
    }
    if (pageNumber < 1 || pageNumber > this.pdfDoc.numPages) {
      console.error('[PDF::renderPage] Invalid page number', pageNumber);
      return;
    }
    const canvasEl = this.pdfCanvas?.nativeElement;
    if (!canvasEl) {
      this.pdfHataMesaji = 'Canvas elementi bulunamadi.';
      console.error('[PDF::renderPage] Canvas not found');
      return;
    }
    const ctx = canvasEl.getContext('2d');
    if (!ctx) {
      this.pdfHataMesaji = 'Canvas context olusturulamadi.';
      console.error('[PDF::renderPage] Canvas context not available');
      return;
    }

    if (this.renderInProgress) {
      this.pendingPage = pageNumber;
      console.info('[PDF::renderPage] Render in progress, queued page', pageNumber);
      return;
    }

    this.renderInProgress = true;
    this.pdfYukleniyor = true;
    console.info('[PDF::renderPage] Rendering page start', pageNumber);

    try {
      const page = await this.pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: this.renderScale });
      canvasEl.width = viewport.width;
      canvasEl.height = viewport.height;
      console.info('[PDF::renderPage] Canvas sized', { width: canvasEl.width, height: canvasEl.height });
      const renderTask = page.render({ canvasContext: ctx, viewport, canvas: canvasEl });
      await renderTask.promise;
      this.currentPage = pageNumber;
      console.info('[PDF::renderPage] Rendering complete', pageNumber);
    } catch (error: any) {
      if (error?.name === 'RenderingCancelledException') {
        console.warn('[PDF::renderPage] Rendering cancelled', pageNumber);
      } else {
        console.error('[PDF::renderPage] Rendering error', error);
        this.pdfHataMesaji = 'Sayfa cizilirken hata olustu.';
      }
    } finally {
      this.renderInProgress = false;
      this.pdfYukleniyor = false;
      if (this.pendingPage && this.pendingPage !== pageNumber) {
        const nextPage = this.pendingPage;
        this.pendingPage = undefined;
        console.info('[PDF::renderPage] Triggering queued page', nextPage);
        await this.renderPage(nextPage);
      } else {
        this.pendingPage = undefined;
      }
    }
  }

  private ensureWorker(): Promise<boolean> {
    if (this.fallbackToMainThread) {
      console.warn('[PDF::ensureWorker] Fallback already active');
      return Promise.resolve(false);
    }

    if (this.workerInstance) {
      console.info('[PDF::ensureWorker] Worker already running');
      return Promise.resolve(true);
    }

    if (!this.workerInitPromise) {
      console.info('[PDF::ensureWorker] Starting worker bootstrap');
      this.workerInitPromise = (async () => {
        try {
          const workerUrl = '/build/pdf.worker.min.mjs';
          console.info('[PDF::ensureWorker] Fetching worker', workerUrl);
          const response = await fetch(workerUrl);
          if (!response.ok) {
            console.error('[PDF::ensureWorker] Worker fetch failed', response.status, response.statusText);
            throw new Error(`HTTP ${response.status}`);
          }
          const scriptText = await response.text();
          console.info('[PDF::ensureWorker] Worker length', scriptText.length);
          const blob = new Blob([scriptText], { type: 'application/javascript' });
          this.workerObjectUrl = URL.createObjectURL(blob);
          console.info('[PDF::ensureWorker] Worker blob URL', this.workerObjectUrl);

          try {
            this.workerInstance = new Worker(this.workerObjectUrl, { type: 'module' });
          } catch (workerError) {
            console.error('[PDF::ensureWorker] Worker creation failed', workerError);
            this.workerInstance = undefined;
            throw workerError;
          }

          this.workerInstance.onerror = (event) => {
            console.error('[PDF::ensureWorker] Worker error', event);
          };
          this.workerInstance.onmessage = (event) => {
            if (event?.data?.type === 'initialize') {
              console.info('[PDF::ensureWorker] Worker initialize message received');
            }
          };

          pdfjsLib.GlobalWorkerOptions.workerPort = this.workerInstance as unknown as Worker;
          pdfjsLib.GlobalWorkerOptions.workerSrc = '';
          console.info('[PDF::ensureWorker] Worker port configured');
          return true;
        } catch (error) {
          console.error('[PDF::ensureWorker] Worker setup failed, falling back', error);
          this.fallbackToMainThread = true;
          pdfjsLib.GlobalWorkerOptions.workerSrc = '';
          return false;
        }
      })();
    }

    return this.workerInitPromise;
  }
}

