import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist/webpack';
import { PDFDocument } from 'pdf-lib';
import type { DocumentInitParameters, PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';

type PdfTool = 'pen' | 'highlighter' | 'eraser';
type BackgroundMode = 'plain' | 'grid' | 'lined';

@Component({
  selector: 'app-ders-anlatim-tahtasi',
  templateUrl: './ders-anlatim-tahasi.component.html',
  styleUrls: ['./ders-anlatim-tahasi.component.scss'],
  standalone: false,
})
export class DersAnlatimTahasiComponent implements OnDestroy, AfterViewInit {
  @ViewChild('pdfCanvas', { static: false }) pdfCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('annotationCanvas', { static: false }) annotationCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('pdfContainer', { static: false }) pdfContainer?: ElementRef<HTMLDivElement>;

  pdfYukleniyor = false;
  pdfHataMesaji = '';

  currentPage = 1;
  totalPages = 1;

  currentTool: PdfTool = 'pen';
  backgroundMode: BackgroundMode = 'plain';
  penColor = '#000000';
  highlighterColor = '#ffff00';
  strokeSize = 8;
  highlighterOpacity = 0.35;
  readonly penColorOptions = ['#000000', '#0000FF', '#FF0000', '#008000'];
  readonly strokeSizeOptions = [8, 10, 12, 14];

  private workerObjectUrl?: string;
  private workerInstance?: Worker;
  private workerInitPromise?: Promise<boolean>;
  private fallbackToMainThread = false;
  private readonly renderScale = 1.5;

  private pdfDoc?: PDFDocumentProxy;
  private blankDocument = true;
  private originalPdfData?: Uint8Array;

  private renderInProgress = false;
  private pendingPage?: number;
  private isDrawing = false;
  private activePointerId?: number;
  private annotationStates = new Map<number, ImageData>();
  private pageBackgrounds = new Map<number, BackgroundMode>();
  private pageMetrics = new Map<number, { canvasWidth: number; canvasHeight: number; pdfWidth?: number; pdfHeight?: number }>();
  exportInProgress = false;

  constructor() {
    console.info('[PDF::ctor] Component created');
  }

  ngAfterViewInit(): void {
    this.initializeBlankDocument();
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
    this.annotationStates.clear();
    this.pageBackgrounds.clear();
    this.pageMetrics.clear();
  }

  get isBlankDocument(): boolean {
    return this.blankDocument;
  }

  async onPdfSec(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    console.info('[PDF::onPdfSec] File selection event', input.files?.[0]?.name);
    const file = input.files?.[0];

    if (!file) {
      console.warn('[PDF::onPdfSec] No file selected');
      return;
    }

    this.annotationStates.clear();
    this.pageBackgrounds.clear();
    this.pageMetrics.clear();
    this.pdfDoc = undefined;
    this.blankDocument = false;
    this.originalPdfData = undefined;
    this.totalPages = 0;
    this.currentPage = 1;
    this.pendingPage = undefined;
    this.clearAnnotationCanvas();
    this.pdfYukleniyor = true;
    this.pdfHataMesaji = '';

    try {
      const workerReady = await this.ensureWorker();
      console.info('[PDF::onPdfSec] Worker status', { workerReady, fallback: this.fallbackToMainThread });

      const buffer = await file.arrayBuffer();
      console.info('[PDF::onPdfSec] File buffer length', buffer.byteLength);
      this.originalPdfData = new Uint8Array(buffer);
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
      this.pdfHataMesaji = 'PDF yüklenirken bir hata oluştu.';
      this.blankDocument = true;
      this.initializeBlankDocument();
    } finally {
      this.pdfYukleniyor = false;
      input.value = '';
      console.info('[PDF::onPdfSec] Operation finished');
    }
  }

  async oncekiSayfa(): Promise<void> {
    if (this.currentPage <= 1) {
      return;
    }
    const target = this.currentPage - 1;
    console.info('[PDF::oncekiSayfa] Target page', target);
    await this.renderPage(target);
  }

  async sonrakiSayfa(): Promise<void> {
    if (this.currentPage >= this.totalPages) {
      return;
    }
    const target = this.currentPage + 1;
    console.info('[PDF::sonrakiSayfa] Target page', target);
    await this.renderPage(target);
  }

  async ilkSayfa(): Promise<void> {
    if (this.currentPage === 1) {
      return;
    }
    console.info('[PDF::ilkSayfa] Navigating to first page');
    await this.renderPage(1);
  }

  async sonSayfa(): Promise<void> {
    if (this.currentPage === this.totalPages) {
      return;
    }
    console.info('[PDF::sonSayfa] Navigating to last page');
    await this.renderPage(this.totalPages);
  }

  async yeniSayfaEkle(): Promise<void> {
    if (!this.blankDocument) {
      return;
    }
    this.saveCurrentAnnotations();
    const yeniSayfa = this.totalPages + 1;
    this.totalPages = yeniSayfa;
    this.pageBackgrounds.set(yeniSayfa, this.backgroundMode);
    console.info('[PDF::yeniSayfaEkle] Added blank page', yeniSayfa);
    await this.renderPage(yeniSayfa);
  }

  setTool(tool: PdfTool): void {
    this.currentTool = tool;
    console.info('[PDF::setTool] Active tool', tool);
  }

  setPenColor(color: string): void {
    this.penColor = color;
    console.info('[PDF::setPenColor] Selected color', color);
  }

  async setBackground(mode: BackgroundMode): Promise<void> {
    this.backgroundMode = mode;
    if (!this.currentPage) {
      return;
    }
    this.pageBackgrounds.set(this.currentPage, mode);
    console.info('[PDF::setBackground] Mode changed', mode, 'page', this.currentPage);
    if (this.blankDocument) {
      this.saveCurrentAnnotations();
      await this.renderPage(this.currentPage);
    }
  }

  clearCurrentAnnotations(): void {
    const page = this.currentPage;
    const ann = this.annotationCanvas?.nativeElement;
    const ctx = ann?.getContext('2d');
    if (!ann || !ctx) {
      return;
    }
    ctx.clearRect(0, 0, ann.width, ann.height);
    if (page) {
      this.annotationStates.delete(page);
    }
    console.info('[PDF::clearCurrentAnnotations] Cleared page', page);
  }

  onPointerDown(event: PointerEvent): void {
    if (event.button !== 0 && event.pointerType !== 'pen' && event.pointerType !== 'touch') {
      return;
    }
    const ann = this.annotationCanvas?.nativeElement;
    const ctx = ann?.getContext('2d');
    if (!ann || !ctx) {
      return;
    }
    if (!this.currentPage) {
      return;
    }
    try {
      ann.setPointerCapture(event.pointerId);
    } catch (err) {
      console.warn('[PDF::onPointerDown] setPointerCapture failed', err);
    }
    const { x, y } = this.getCanvasPoint(event, ann);
    this.isDrawing = true;
    this.activePointerId = event.pointerId;
    this.configureStroke(ctx);
    ctx.beginPath();
    ctx.moveTo(x, y);
    event.preventDefault();
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.isDrawing || this.activePointerId !== event.pointerId) {
      return;
    }
    const ann = this.annotationCanvas?.nativeElement;
    const ctx = ann?.getContext('2d');
    if (!ann || !ctx) {
      return;
    }
    const { x, y } = this.getCanvasPoint(event, ann);
    ctx.lineTo(x, y);
    ctx.stroke();
    event.preventDefault();
  }

  onPointerUp(event: PointerEvent): void {
    if (this.activePointerId !== event.pointerId) {
      return;
    }
    this.finishStroke(event);
  }

  onPointerCancel(event: PointerEvent): void {
    if (this.activePointerId !== event.pointerId) {
      return;
    }
    this.finishStroke(event);
  }

  private async renderPage(pageNumber: number): Promise<void> {
    if (this.renderInProgress) {
      this.pendingPage = pageNumber;
      console.info('[PDF::renderPage] Render in progress, queued page', pageNumber);
      return;
    }

    const pdfCanvasEl = this.pdfCanvas?.nativeElement;
    const annCanvasEl = this.annotationCanvas?.nativeElement;
    if (!pdfCanvasEl || !annCanvasEl) {
      this.pdfHataMesaji = 'Canvas elementi bulunamadı.';
      console.error('[PDF::renderPage] Canvas not found');
      return;
    }

    if (this.currentPage && this.currentPage !== pageNumber) {
      this.saveCurrentAnnotations();
    }

    this.renderInProgress = true;
    const isPdfRender = !this.blankDocument && !!this.pdfDoc;
    this.pdfYukleniyor = isPdfRender;
    console.info('[PDF::renderPage] Rendering page start', pageNumber, 'pdfRender', isPdfRender);

    try {
      const pdfCtx = pdfCanvasEl.getContext('2d');
      if (!pdfCtx) {
        this.pdfHataMesaji = 'Canvas context oluşturulamadı.';
        console.error('[PDF::renderPage] Canvas context not available');
        return;
      }

        if (!this.blankDocument && this.pdfDoc) {
          const page = await this.pdfDoc.getPage(pageNumber);
          const viewport = page.getViewport({ scale: this.renderScale });
          pdfCanvasEl.width = viewport.width;
          pdfCanvasEl.height = viewport.height;
          this.pageMetrics.set(pageNumber, {
            canvasWidth: pdfCanvasEl.width,
            canvasHeight: pdfCanvasEl.height,
            pdfWidth: viewport.width / this.renderScale,
            pdfHeight: viewport.height / this.renderScale,
          });
          this.prepareAnnotationCanvas(viewport.width, viewport.height);

          const renderTask = page.render({ canvasContext: pdfCtx, viewport, canvas: pdfCanvasEl });
          await renderTask.promise;
        } else {
        this.blankDocument = true;
        this.drawBlankBackground(pageNumber, pdfCanvasEl, pdfCtx);
      }

      this.currentPage = pageNumber;
      this.restoreAnnotations(pageNumber);
      console.info('[PDF::renderPage] Rendering complete', pageNumber);
    } catch (error: any) {
      if (error?.name === 'RenderingCancelledException') {
        console.warn('[PDF::renderPage] Rendering cancelled', pageNumber);
      } else {
        console.error('[PDF::renderPage] Rendering error', error);
        this.pdfHataMesaji = 'Sayfa çizilirken hata oluştu.';
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

  private initializeBlankDocument(): void {
    if (!this.blankDocument) {
      return;
    }
    this.originalPdfData = undefined;
    this.pageMetrics.clear();
    this.totalPages = Math.max(this.totalPages, 1);
    this.currentPage = Math.max(this.currentPage, 1);
    if (!this.pageBackgrounds.has(this.currentPage)) {
      this.pageBackgrounds.set(this.currentPage, this.backgroundMode);
    }
    void this.renderPage(this.currentPage);
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

  private configureStroke(ctx: CanvasRenderingContext2D): void {
    const size = Math.max(1, Number(this.strokeSize) || 1);
    ctx.lineWidth = size;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    switch (this.currentTool) {
      case 'pen':
        ctx.strokeStyle = this.penColor;
        break;
      case 'highlighter':
        ctx.strokeStyle = this.highlighterColor;
        ctx.globalAlpha = this.highlighterOpacity;
        break;
      case 'eraser':
        ctx.strokeStyle = '#000000';
        ctx.globalCompositeOperation = 'destination-out';
        break;
    }
  }

  private finishStroke(event: PointerEvent): void {
    const ann = this.annotationCanvas?.nativeElement;
    const ctx = ann?.getContext('2d');
    if (ann && ctx) {
      ctx.closePath();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      if (ann.hasPointerCapture?.(event.pointerId)) {
        try {
          ann.releasePointerCapture(event.pointerId);
        } catch (err) {
          console.warn('[PDF::finishStroke] releasePointerCapture failed', err);
        }
      }
    }
    this.isDrawing = false;
    this.activePointerId = undefined;
    this.saveCurrentAnnotations();
    event.preventDefault();
  }

  async downloadPdf(): Promise<void> {
    if (this.exportInProgress) {
      return;
    }

    this.exportInProgress = true;
    const previousPage = this.currentPage;
    this.pdfHataMesaji = '';
    try {
      await this.saveCurrentAnnotations();
      const pageImages: Array<{ page: number; dataUrl: string; width: number; height: number }> = [];

      for (let page = 1; page <= this.totalPages; page++) {
        await this.renderPage(page);
        const combined = this.combineCurrentPageToDataUrl();
        if (combined) {
          pageImages.push({ page, ...combined });
        } else {
          console.warn('[PDF::downloadPdf] Sayfa goruntusu alinamadi', page);
        }
      }

      if (!pageImages.length) {
        console.warn('[PDF::downloadPdf] Indirilecek sayfa bulunamadi');
        return;
      }

      let pdfBytes: Uint8Array;
      if (!this.blankDocument && this.originalPdfData) {
        const pdfDoc = await PDFDocument.load(this.originalPdfData.slice());
        for (let index = 0; index < pageImages.length; index++) {
          const info = pageImages[index];
          const pngImage = await pdfDoc.embedPng(this.dataUrlToUint8Array(info.dataUrl));
          const page =
            index < pdfDoc.getPageCount()
              ? pdfDoc.getPage(index)
              : pdfDoc.addPage([info.width, info.height]);
          const { width, height } = page.getSize();
          page.drawImage(pngImage, { x: 0, y: 0, width, height });
        }
        pdfBytes = await pdfDoc.save();
      } else {
        const pdfDoc = await PDFDocument.create();
        for (const info of pageImages) {
          const pngImage = await pdfDoc.embedPng(this.dataUrlToUint8Array(info.dataUrl));
          const page = pdfDoc.addPage([info.width, info.height]);
          page.drawImage(pngImage, { x: 0, y: 0, width: info.width, height: info.height });
        }
        pdfBytes = await pdfDoc.save();
      }

      const fileName = `ders-anlatim-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
      this.triggerFileDownload(pdfBytes, fileName);
      console.info('[PDF::downloadPdf] PDF indirildi', fileName);
    } catch (error) {
      console.error('[PDF::downloadPdf] PDF aktariminda hata olustu', error);
      this.pdfHataMesaji = 'PDF indirirken hata olustu.';
    } finally {
      if (previousPage !== this.currentPage) {
        await this.renderPage(previousPage);
      }
      this.exportInProgress = false;
    }
  }

  private prepareAnnotationCanvas(width: number, height: number): void {
    const ann = this.annotationCanvas?.nativeElement;
    const ctx = ann?.getContext('2d');
    if (!ann || !ctx) {
      return;
    }
    ann.width = width;
    ann.height = height;
    ctx.clearRect(0, 0, width, height);
  }

  private drawBlankBackground(
    pageNumber: number,
    pdfCanvasEl: HTMLCanvasElement,
    pdfCtx: CanvasRenderingContext2D,
  ): void {
    const containerWidth =
      this.pdfContainer?.nativeElement.clientWidth ??
      pdfCanvasEl.parentElement?.clientWidth ??
      window.innerWidth ??
      900;
    const width = Math.max(720, Math.round(containerWidth));
    const height = Math.round(width * 1.414); // A4 oranı

    pdfCanvasEl.width = width;
    pdfCanvasEl.height = height;

    pdfCtx.fillStyle = '#ffffff';
    pdfCtx.fillRect(0, 0, width, height);

    const background = this.pageBackgrounds.get(pageNumber) ?? this.backgroundMode;
    this.pageBackgrounds.set(pageNumber, background);

    pdfCtx.save();
    pdfCtx.strokeStyle = '#dbe4ff';
    pdfCtx.lineWidth = 1;
    pdfCtx.globalAlpha = 0.6;

    if (background === 'grid') {
      const step = 40;
      for (let x = step; x < width; x += step) {
        pdfCtx.beginPath();
        pdfCtx.moveTo(x, 0);
        pdfCtx.lineTo(x, height);
        pdfCtx.stroke();
      }
      for (let y = step; y < height; y += step) {
        pdfCtx.beginPath();
        pdfCtx.moveTo(0, y);
        pdfCtx.lineTo(width, y);
        pdfCtx.stroke();
      }
    } else if (background === 'lined') {
      const step = 48;
      pdfCtx.strokeStyle = '#cfd8ff';
      for (let y = step; y < height; y += step) {
        pdfCtx.beginPath();
        pdfCtx.moveTo(0, y);
        pdfCtx.lineTo(width, y);
        pdfCtx.stroke();
      }
      }

      pdfCtx.restore();
      this.pageMetrics.set(pageNumber, {
        canvasWidth: width,
        canvasHeight: height,
        pdfWidth: width,
        pdfHeight: height,
      });
      this.prepareAnnotationCanvas(width, height);
    }

  private saveCurrentAnnotations(): void {
    const page = this.currentPage;
    const ann = this.annotationCanvas?.nativeElement;
    const ctx = ann?.getContext('2d');
    if (!page || !ann || !ctx) {
      return;
    }
    try {
      const data = ctx.getImageData(0, 0, ann.width, ann.height);
      this.annotationStates.set(page, data);
      console.info('[PDF::saveCurrentAnnotations] Saved page', page);
    } catch (error) {
      console.error('[PDF::saveCurrentAnnotations] Failed to capture annotations', error);
    }
  }

  private restoreAnnotations(pageNumber: number): void {
    const ann = this.annotationCanvas?.nativeElement;
    const ctx = ann?.getContext('2d');
    if (!ann || !ctx) {
      return;
    }
    ctx.clearRect(0, 0, ann.width, ann.height);
    const saved = this.annotationStates.get(pageNumber);
    if (saved && saved.width === ann.width && saved.height === ann.height) {
      ctx.putImageData(saved, 0, 0);
      console.info('[PDF::restoreAnnotations] Restored page', pageNumber);
    } else {
      console.info('[PDF::restoreAnnotations] No saved annotations for page', pageNumber);
    }
  }

  private clearAnnotationCanvas(): void {
    const ann = this.annotationCanvas?.nativeElement;
    const ctx = ann?.getContext('2d');
    if (!ann || !ctx) {
      return;
    }
    ctx.clearRect(0, 0, ann.width, ann.height);
  }

  private getCanvasPoint(event: PointerEvent, canvas: HTMLCanvasElement): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  private combineCurrentPageToDataUrl(): { dataUrl: string; width: number; height: number } | null {
    const pdfCanvasEl = this.pdfCanvas?.nativeElement;
    if (!pdfCanvasEl || !pdfCanvasEl.width || !pdfCanvasEl.height) {
      return null;
    }
    const out = document.createElement('canvas');
    out.width = pdfCanvasEl.width;
    out.height = pdfCanvasEl.height;
    const ctx = out.getContext('2d');
    if (!ctx) {
      return null;
    }
    ctx.drawImage(pdfCanvasEl, 0, 0);
    const ann = this.annotationCanvas?.nativeElement;
    if (ann) {
      ctx.drawImage(ann, 0, 0);
    }
    return { dataUrl: out.toDataURL('image/png'), width: out.width, height: out.height };
  }

  private dataUrlToUint8Array(dataUrl: string): Uint8Array {
    const base64 = dataUrl.split(',')[1] ?? '';
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  private triggerFileDownload(bytes: Uint8Array, fileName: string): void {
    const buffer = ArrayBuffer.isView(bytes)
      ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
      : bytes;
    const blob = new Blob([buffer as ArrayBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
