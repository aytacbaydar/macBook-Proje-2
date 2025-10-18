import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist/webpack';
import { PDFDocument } from 'pdf-lib';
import * as fabric from 'fabric';
import type { DocumentInitParameters, PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';

type PdfTool = 'select' | 'pen' | 'highlighter' | 'eraser';
type BackgroundMode = 'plain' | 'grid' | 'lined';
type FabricCanvasJSON = ReturnType<fabric.Canvas['toJSON']>;

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
  private fabricCanvas?: fabric.Canvas;
  private annotationStates = new Map<number, FabricCanvasJSON>();
  private pageBackgrounds = new Map<number, BackgroundMode>();
  private pageMetrics = new Map<number, { canvasWidth: number; canvasHeight: number; pdfWidth?: number; pdfHeight?: number }>();
  exportInProgress = false;

  constructor() {
    console.info('[PDF::ctor] Component created');
  }

  ngAfterViewInit(): void {
    this.initializeFabricCanvas();
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
    if (this.fabricCanvas) {
      this.fabricCanvas.dispose();
      this.fabricCanvas = undefined;
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
    this.configureFabricBrush();
  }

  setPenColor(color: string): void {
    this.penColor = color;
    console.info('[PDF::setPenColor] Selected color', color);
    if (this.currentTool === 'pen') {
      this.configureFabricBrush();
    }
  }

  onStrokeSizeChange(size: number): void {
    this.strokeSize = Number(size);
    if (this.currentTool !== 'select') {
      this.configureFabricBrush();
    }
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
    if (!this.fabricCanvas) {
      return;
    }
    this.fabricCanvas.discardActiveObject();
    this.fabricCanvas
      .getObjects()
      .slice()
      .forEach((obj: fabric.Object) => this.fabricCanvas?.remove(obj));
    this.fabricCanvas.requestRenderAll();
    if (this.currentTool !== 'select') {
      this.updateObjectInteractivity(false);
    } else {
      this.updateObjectInteractivity(true);
    }
    if (page) {
      this.annotationStates.delete(page);
    }
    this.saveCurrentAnnotations();
    console.info('[PDF::clearCurrentAnnotations] Cleared page', page);
  }

  private async renderPage(pageNumber: number): Promise<void> {
    if (this.renderInProgress) {
      this.pendingPage = pageNumber;
      console.info('[PDF::renderPage] Render in progress, queued page', pageNumber);
      return;
    }

    const pdfCanvasEl = this.pdfCanvas?.nativeElement;
    if (!pdfCanvasEl || !this.annotationCanvas?.nativeElement) {
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
        pdfCtx.clearRect(0, 0, pdfCanvasEl.width, pdfCanvasEl.height);
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
      await this.restoreAnnotations(pageNumber);
      this.configureFabricBrush();
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

  private initializeFabricCanvas(): void {
    const ann = this.annotationCanvas?.nativeElement;
    if (!ann) {
      console.warn('[PDF::initFabric] Annotation canvas not found');
      return;
    }

    this.fabricCanvas = new fabric.Canvas(ann, {
      selection: false,
      isDrawingMode: true,
      preserveObjectStacking: true,
    });
    this.fabricCanvas.perPixelTargetFind = true;
    this.fabricCanvas.defaultCursor = 'crosshair';
    this.fabricCanvas.hoverCursor = 'move';
    this.fabricCanvas.setBackgroundColor('transparent', undefined);
    this.fabricCanvas.freeDrawingBrush = new fabric.PencilBrush(this.fabricCanvas);
    this.configureFabricBrush();

    const saveState = () => this.saveCurrentAnnotations();
    this.fabricCanvas.on('path:created', () => {
      if (this.currentTool !== 'select') {
        this.updateObjectInteractivity(false);
      }
      saveState();
    });
    this.fabricCanvas.on('object:modified', saveState);
    this.fabricCanvas.on('object:removed', saveState);
    this.fabricCanvas.on('object:added', (event: fabric.TPointerEventInfo) => {
      if (!event.target) {
        return;
      }
      if (this.currentTool !== 'select') {
        event.target.selectable = false;
        event.target.evented = false;
      }
    });
  }

  private configureFabricBrush(): void {
    if (!this.fabricCanvas) {
      return;
    }

    if (this.currentTool === 'select') {
      this.fabricCanvas.isDrawingMode = false;
      this.fabricCanvas.selection = true;
      this.fabricCanvas.defaultCursor = 'default';
      this.fabricCanvas.hoverCursor = 'move';
      this.updateObjectInteractivity(true);
      this.fabricCanvas.requestRenderAll();
      return;
    }

    this.fabricCanvas.isDrawingMode = true;
    this.fabricCanvas.selection = false;
    this.fabricCanvas.defaultCursor = 'crosshair';
    this.fabricCanvas.hoverCursor = 'crosshair';
    this.fabricCanvas.discardActiveObject();
    this.updateObjectInteractivity(false);

    const width = Math.max(1, Number(this.strokeSize) || 1);

    const fabricAny = fabric as any;
    if (this.currentTool === 'eraser' && fabricAny.EraserBrush) {
      const eraserBrush = new fabricAny.EraserBrush(this.fabricCanvas);
      eraserBrush.width = width;
      this.fabricCanvas.freeDrawingBrush = eraserBrush;
    } else {
      const pencilBrush = new fabric.PencilBrush(this.fabricCanvas);
      pencilBrush.width = width;
      pencilBrush.color =
        this.currentTool === 'highlighter'
          ? this.hexToRgba(this.highlighterColor, this.highlighterOpacity)
          : this.penColor;
      this.fabricCanvas.freeDrawingBrush = pencilBrush;
    }

    this.fabricCanvas.requestRenderAll();
  }

  private updateObjectInteractivity(selectable: boolean): void {
    if (!this.fabricCanvas) {
      return;
    }
    this.fabricCanvas.forEachObject((obj: fabric.Object) => {
      obj.selectable = selectable;
      obj.evented = selectable;
    });
  }

  private hexToRgba(hex: string, alpha: number): string {
    const normalized = hex.replace('#', '');
    const bigint = parseInt(normalized, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  async downloadPdf(): Promise<void> {
    if (this.exportInProgress) {
      return;
    }

    this.exportInProgress = true;
    const previousPage = this.currentPage;
    this.pdfHataMesaji = '';
    try {
      this.saveCurrentAnnotations();
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
    if (!ann) {
      return;
    }
    ann.width = width;
    ann.height = height;
    if (this.fabricCanvas) {
      this.fabricCanvas.setDimensions({ width, height });
      this.fabricCanvas.calcOffset();
      if (this.currentTool !== 'select') {
        this.updateObjectInteractivity(false);
      } else {
        this.updateObjectInteractivity(true);
      }
      this.fabricCanvas.renderAll();
    }
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
    if (!this.fabricCanvas || !this.currentPage) {
      return;
    }
    const objects = this.fabricCanvas.getObjects();
    if (!objects.length) {
      this.annotationStates.delete(this.currentPage);
      return;
    }
    const json = this.fabricCanvas.toJSON(['eraser']);
    this.annotationStates.set(this.currentPage, json);
    console.info('[PDF::saveCurrentAnnotations] Saved page', this.currentPage);
  }

  private async restoreAnnotations(pageNumber: number): Promise<void> {
    if (!this.fabricCanvas) {
      return;
    }
    this.fabricCanvas.discardActiveObject();
    this.fabricCanvas
      .getObjects()
      .slice()
      .forEach((obj: fabric.Object) => this.fabricCanvas?.remove(obj));

    const json = this.annotationStates.get(pageNumber);
    if (!json) {
      if (this.currentTool !== 'select') {
        this.updateObjectInteractivity(false);
      } else {
        this.updateObjectInteractivity(true);
      }
      this.fabricCanvas.renderAll();
      console.info('[PDF::restoreAnnotations] No saved annotations for page', pageNumber);
      return;
    }

    await new Promise<void>((resolve) => {
      this.fabricCanvas!.loadFromJSON(json, () => {
        if (this.currentTool !== 'select') {
          this.updateObjectInteractivity(false);
        } else {
          this.updateObjectInteractivity(true);
        }
        this.fabricCanvas!.renderAll();
        console.info('[PDF::restoreAnnotations] Restored page', pageNumber);
        resolve();
      });
    });
  }

  private clearAnnotationCanvas(): void {
    if (!this.fabricCanvas) {
      const ann = this.annotationCanvas?.nativeElement;
      const ctx = ann?.getContext('2d');
      if (ann && ctx) {
        ctx.clearRect(0, 0, ann.width, ann.height);
      }
      return;
    }
    this.fabricCanvas.discardActiveObject();
    this.fabricCanvas.getObjects()
      .slice()
      .forEach((obj: fabric.Object) => this.fabricCanvas?.remove(obj));
    this.fabricCanvas.renderAll();
    if (this.currentTool !== 'select') {
      this.updateObjectInteractivity(false);
    } else {
      this.updateObjectInteractivity(true);
    }
  }

  private combineCurrentPageToDataUrl(): { dataUrl: string; width: number; height: number } | null {
    const pdfCanvasEl = this.pdfCanvas?.nativeElement;
    if (!pdfCanvasEl || !pdfCanvasEl.width || !pdfCanvasEl.height) {
      return null;
    }
    this.fabricCanvas?.discardActiveObject();
    this.fabricCanvas?.renderAll();
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
    const copy = new Uint8Array(bytes.length);
    copy.set(bytes);
    const blob = new Blob([copy.buffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
