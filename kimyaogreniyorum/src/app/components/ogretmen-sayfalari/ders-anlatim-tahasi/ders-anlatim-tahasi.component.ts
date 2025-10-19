import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, ViewChild } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist/webpack';
import { PDFDocument } from 'pdf-lib';
import * as fabric from 'fabric';
import type { DocumentInitParameters, PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import { AlertService } from '../../../services/alert.service';

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
  @ViewChild('imageUploadInput', { static: false }) imageUploadInput?: ElementRef<HTMLInputElement>;

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
  private hasUnsavedChanges = false;
  private suppressUnsavedTracking = false;
  hasSelection = false;
  private allowSelectableForNextObject = false;
  isCropping = false;
  private cropRect?: fabric.Rect;
  private cropTarget?: fabric.Image;
  selectionMenu = {
    visible: false,
    left: 0,
    top: 0,
    showCropActions: false,
    showCrop: false,
    showPaste: false,
  };
  clipboardObject?: fabric.Object;

  constructor(private readonly alertService: AlertService) {
    console.info('[PDF::ctor] Component created');
  }

  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasPendingChanges()) {
      event.preventDefault();
      event.returnValue = 'Çıkarsanız kaydedilmemiş çizimleriniz silinecek.';
    }
  }

  hasPendingChanges(): boolean {
    return this.hasUnsavedChanges && !this.exportInProgress;
  }

  private markUnsavedChange(): void {
    if (!this.suppressUnsavedTracking) {
      this.hasUnsavedChanges = true;
    }
  }

  private clearUnsavedChanges(): void {
    this.hasUnsavedChanges = false;
  }

  private runWithoutUnsavedTracking<T>(operation: () => T): T {
    const previous = this.suppressUnsavedTracking;
    this.suppressUnsavedTracking = true;
    try {
      return operation();
    } finally {
      this.suppressUnsavedTracking = previous;
    }
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
    this.clearUnsavedChanges();
  }

  private showError(message: string, title = 'Hata'): void {
    this.pdfHataMesaji = message;
    void this.alertService.error(message, title);
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
    this.clearUnsavedChanges();
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
      this.showError('PDF yüklenirken bir hata oluştu.', 'PDF Hatası');
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
    this.markUnsavedChange();
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
      this.markUnsavedChange();
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
    this.updateSelectionState(false);
    if (page) {
      this.annotationStates.delete(page);
    }
    this.saveCurrentAnnotations();
    this.markUnsavedChange();
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
      this.showError('Canvas elementi bulunamadı.', 'Teknik Hata');
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
        this.showError('Canvas context oluşturulamadı.', 'Teknik Hata');
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
        this.showError('Sayfa çizilirken hata oluştu.', 'Çizim Hatası');
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
    this.clearUnsavedChanges();
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
    this.fabricCanvas.backgroundColor = 'transparent';
    this.applyFabricCanvasStyles();
    this.fabricCanvas.freeDrawingBrush = new fabric.PencilBrush(this.fabricCanvas);
    this.configureFabricBrush();

    const saveState = () => {
      this.saveCurrentAnnotations();
    };
    const handleChange = () => {
      this.markUnsavedChange();
    };
    this.fabricCanvas.on('path:created', () => {
      if (this.currentTool !== 'select') {
        this.updateObjectInteractivity(false);
      }
      saveState();
      handleChange();
    });
    this.fabricCanvas.on('object:modified', () => {
      saveState();
      handleChange();
      const hasActiveObjects = !!this.fabricCanvas && this.fabricCanvas.getActiveObjects().length > 0;
      const active = this.fabricCanvas?.getActiveObject() ?? null;
      this.updateSelectionState(hasActiveObjects, active ?? undefined);
    });
    this.fabricCanvas.on('object:removed', () => {
      saveState();
      handleChange();
      const hasActiveObjects = !!this.fabricCanvas && this.fabricCanvas.getActiveObjects().length > 0;
      const active = this.fabricCanvas?.getActiveObject() ?? null;
      this.updateSelectionState(hasActiveObjects, active ?? undefined);
    });
    this.fabricCanvas.on('object:added', ({ target }) => {
      if (!target) {
        return;
      }
      if (this.allowSelectableForNextObject) {
        target.selectable = true;
        target.evented = true;
        this.allowSelectableForNextObject = false;
      } else if (this.currentTool !== 'select') {
        target.selectable = false;
        target.evented = false;
      }
      if (!this.suppressUnsavedTracking) {
        handleChange();
      }
      const hasActiveObjects = !!this.fabricCanvas && this.fabricCanvas.getActiveObjects().length > 0;
      this.updateSelectionState(hasActiveObjects, target);
    });
    this.fabricCanvas.on('selection:created', () => {
      const active = this.fabricCanvas?.getActiveObject() ?? null;
      this.updateSelectionState(true, active ?? undefined);
    });
    this.fabricCanvas.on('selection:updated', () => {
      const active = this.fabricCanvas?.getActiveObject() ?? null;
      this.updateSelectionState(true, active ?? undefined);
    });
    this.fabricCanvas.on('selection:cleared', () => this.updateSelectionState(false));
  }

  private configureFabricBrush(): void {
    if (!this.fabricCanvas) {
      return;
    }

    const isDrawingTool = this.currentTool !== 'select';
    this.fabricCanvas.isDrawingMode = isDrawingTool;
    this.fabricCanvas.selection = !isDrawingTool;
    this.fabricCanvas.defaultCursor = isDrawingTool ? 'crosshair' : 'default';
    this.fabricCanvas.hoverCursor = isDrawingTool ? 'crosshair' : 'move';
    this.fabricCanvas.freeDrawingCursor = 'crosshair';
    if (this.fabricCanvas.upperCanvasEl) {
      this.fabricCanvas.upperCanvasEl.style.cursor = isDrawingTool ? 'crosshair' : 'move';
    }

    if (!isDrawingTool) {
      this.updateObjectInteractivity(true);
      this.fabricCanvas.requestRenderAll();
      return;
    }

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

    if (this.fabricCanvas.freeDrawingBrush) {
      this.fabricCanvas.freeDrawingBrush.width = width;
      if (this.currentTool !== 'eraser') {
        this.fabricCanvas.freeDrawingBrush.color =
          this.currentTool === 'highlighter'
            ? this.hexToRgba(this.highlighterColor, this.highlighterOpacity)
            : this.penColor;
      }
    }

    this.fabricCanvas.requestRenderAll();
  }

  private applyFabricCanvasStyles(width?: number, height?: number): void {
    if (!this.fabricCanvas) {
      return;
    }

    const wrapper = this.fabricCanvas.wrapperEl as HTMLElement | undefined;
    if (wrapper) {
      wrapper.style.position = 'absolute';
      wrapper.style.left = '0';
      wrapper.style.top = '0';
      wrapper.style.width = width ? `${width}px` : '100%';
      wrapper.style.height = height ? `${height}px` : '100%';
      wrapper.style.pointerEvents = 'auto';
      wrapper.style.touchAction = 'none';
      wrapper.style.background = 'transparent';
      wrapper.style.zIndex = '2';
    }

    const upper = this.fabricCanvas.upperCanvasEl as HTMLCanvasElement | undefined;
    if (upper) {
      upper.style.pointerEvents = 'auto';
      upper.style.touchAction = 'none';
      upper.style.backgroundColor = 'transparent';
      upper.style.width = width ? `${width}px` : '100%';
      upper.style.height = height ? `${height}px` : '100%';
    }

    const lower = this.fabricCanvas.lowerCanvasEl as HTMLCanvasElement | undefined;
    if (lower) {
      lower.style.pointerEvents = 'none';
      lower.style.backgroundColor = 'transparent';
      lower.style.width = width ? `${width}px` : '100%';
      lower.style.height = height ? `${height}px` : '100%';
    }
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
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        await new Promise<void>((resolve) => setTimeout(resolve, 60));
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
      void this.alertService.success('PDF başarıyla indirildi.', 'İndirme Hazır');
      this.clearUnsavedChanges();
      console.info('[PDF::downloadPdf] PDF indirildi', fileName);
    } catch (error) {
      console.error('[PDF::downloadPdf] PDF aktariminda hata olustu', error);
      this.showError('PDF indirirken hata oluştu.', 'PDF Hatası');
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
      this.applyFabricCanvasStyles(width, height);
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
    const json = this.fabricCanvas.toJSON();
    this.annotationStates.set(this.currentPage, json);
    console.info('[PDF::saveCurrentAnnotations] Saved page', this.currentPage);
  }

  private async restoreAnnotations(pageNumber: number): Promise<void> {
    if (!this.fabricCanvas) {
      return;
    }
    await this.runWithoutUnsavedTracking(async () => {
      this.fabricCanvas!.discardActiveObject();
      this.fabricCanvas!
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
        this.fabricCanvas!.renderAll();
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
    this.runWithoutUnsavedTracking(() => {
      this.fabricCanvas!.discardActiveObject();
      this.fabricCanvas!
        .getObjects()
        .slice()
        .forEach((obj: fabric.Object) => this.fabricCanvas?.remove(obj));
      this.fabricCanvas!.renderAll();
      if (this.currentTool !== 'select') {
        this.updateObjectInteractivity(false);
      } else {
        this.updateObjectInteractivity(true);
      }
      this.updateSelectionState(false);
    });
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
    const lower = this.fabricCanvas?.lowerCanvasEl;
    const upper = this.fabricCanvas?.upperCanvasEl;
    if (lower) {
      ctx.drawImage(lower, 0, 0);
    }
    if (upper) {
      ctx.drawImage(upper, 0, 0);
    } else if (this.annotationCanvas?.nativeElement) {
      ctx.drawImage(this.annotationCanvas.nativeElement, 0, 0);
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

  async duplicateSelection(): Promise<void> {
    const canvas = this.fabricCanvas;
    const active = canvas?.getActiveObject();
    if (!canvas || !active) {
      return;
    }

    const clone = await active.clone();
    this.clipboardObject = await active.clone();
    this.clipboardObject.set({
      left: active.left ?? 0,
      top: active.top ?? 0,
    });
    clone.set({
      left: active.left ?? 0,
      top: active.top ?? 0,
      evented: true,
      selectable: true,
    });
    clone.setCoords();
    canvas.add(clone);
    canvas.setActiveObject(clone);
    canvas.requestRenderAll();
    this.updateSelectionState(true, clone);
    this.markUnsavedChange();
    this.alertService.success('Öğe kopyalandı.', 'Kopyalandı');
  }

  async cutSelection(): Promise<void> {
    const canvas = this.fabricCanvas;
    const active = canvas?.getActiveObject();
    if (!canvas || !active) {
      return;
    }
    this.clipboardObject = await active.clone();
    this.clipboardObject.set({
      left: active.left ?? 0,
      top: active.top ?? 0,
    });
    this.selectionMenu.visible = false;
    this.hasSelection = false;
    canvas.remove(active);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    this.updateSelectionState(false);
    this.markUnsavedChange();
    this.alertService.info('Seçim panoya kesildi. Yapıştırmak için Yapıştır seçeneğini kullanın.', 'Kesildi');
  }

  async pasteSelection(): Promise<void> {
    const canvas = this.fabricCanvas;
    if (!canvas || !this.clipboardObject) {
      this.alertService.warning('Panoda yapıştırılacak öğe bulunamadı.', 'Panoya Erişim');
      return;
    }
    const clone = await this.clipboardObject.clone();
    const left = this.clipboardObject.left ?? 0;
    const top = this.clipboardObject.top ?? 0;
    clone.set({
      left,
      top,
      evented: true,
      selectable: true,
    });
    clone.setCoords();
    canvas.add(clone);
    canvas.setActiveObject(clone);
    canvas.requestRenderAll();
    this.updateSelectionState(true, clone);
    this.markUnsavedChange();
    this.alertService.success('Öğe yapıştırıldı.', 'Yapıştırıldı');
  }

  deleteSelection(): void {
    const canvas = this.fabricCanvas;
    const active = canvas?.getActiveObject();
    if (!canvas || !active) {
      return;
    }
    if (active instanceof fabric.ActiveSelection) {
      active.getObjects().forEach((obj) => canvas.remove(obj));
    } else {
      canvas.remove(active);
    }
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    this.updateSelectionState(false);
    this.markUnsavedChange();
    this.alertService.info('Seçili öğe silindi.', 'Silindi');
  }

  startCrop(): void {
    if (this.isCropping) {
      return;
    }
    const canvas = this.fabricCanvas;
    const active = canvas?.getActiveObject();
    if (!canvas || !active || !(active instanceof fabric.Image)) {
      this.alertService.warning('Kırpma için bir görsel seçin.', 'Görsel Seçilmedi');
      return;
    }
    if (Math.abs(active.angle ?? 0) > 0.001) {
      this.alertService.warning('Döndürülmüş görsellerde kırpma desteklenmiyor.', 'Kırpma Desteklenmiyor');
      return;
    }
    active.setCoords();
    const bounds = active.getBoundingRect();
    const rect = new fabric.Rect({
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
      fill: 'rgba(37, 99, 235, 0.15)',
      stroke: '#2563eb',
      strokeDashArray: [6, 4],
      strokeWidth: 1.5,
      originX: 'left',
      originY: 'top',
      transparentCorners: false,
      cornerColor: '#2563eb',
      borderColor: '#2563eb',
      hasRotatingPoint: false,
      selectable: true,
      evented: true,
    });
    rect.lockRotation = true;
    rect.on('moving', () => this.updateCropMenuPosition());
    rect.on('scaling', () => this.updateCropMenuPosition());
    rect.on('modified', () => this.updateCropMenuPosition());

    this.isCropping = true;
    this.selectionMenu.visible = false;
    this.hasSelection = false;
    this.cropTarget = active;
    this.cropRect = rect;
    active.selectable = false;
    active.evented = false;
    canvas.add(rect);
    canvas.setActiveObject(rect);
    canvas.bringObjectToFront(rect);
    this.updateCropMenuPosition();
  }

  cancelCrop(): void {
    if (!this.isCropping) {
      return;
    }
    if (this.cropRect && this.fabricCanvas) {
      this.fabricCanvas.remove(this.cropRect);
    }
    if (this.cropTarget) {
      this.cropTarget.selectable = true;
      this.cropTarget.evented = true;
      this.fabricCanvas?.setActiveObject(this.cropTarget);
      this.updateSelectionState(true, this.cropTarget);
    } else {
      this.updateSelectionState(false);
    }
    this.cropRect = undefined;
    this.cropTarget = undefined;
    this.isCropping = false;
    this.fabricCanvas?.requestRenderAll();
  }

  async confirmCrop(): Promise<void> {
    if (!this.isCropping || !this.cropRect || !this.cropTarget || !this.fabricCanvas) {
      return;
    }
    const canvas = this.fabricCanvas;
    const rect = this.cropRect;
    const target = this.cropTarget;
    target.setCoords();
    rect.setCoords();
    const targetBounds = target.getBoundingRect();
    const rectBounds = rect.getBoundingRect();

    const scaleX = target.getScaledWidth() / (target.width ?? 1);
    const scaleY = target.getScaledHeight() / (target.height ?? 1);
    let sourceX = (rectBounds.left - targetBounds.left) / scaleX + (target.cropX ?? 0);
    let sourceY = (rectBounds.top - targetBounds.top) / scaleY + (target.cropY ?? 0);
    let sourceWidth = rectBounds.width / scaleX;
    let sourceHeight = rectBounds.height / scaleY;

    sourceX = Math.max(0, sourceX);
    sourceY = Math.max(0, sourceY);
    sourceWidth = Math.max(1, Math.min(sourceWidth, (target.width ?? 0) - sourceX));
    sourceHeight = Math.max(1, Math.min(sourceHeight, (target.height ?? 0) - sourceY));

    const element = target.getElement();
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = Math.round(sourceWidth);
    tempCanvas.height = Math.round(sourceHeight);
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) {
      this.alertService.error('Kırpma işlemi başlatılamadı.', 'Kırpma Hatası');
      return;
    }
    ctx.drawImage(
      element,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      tempCanvas.width,
      tempCanvas.height,
    );
    const dataUrl = tempCanvas.toDataURL();
    const insertionIndex = canvas.getObjects().indexOf(target);

    canvas.remove(rect);
    canvas.remove(target);
    this.cropRect = undefined;
    this.cropTarget = undefined;
    this.isCropping = false;
    this.selectionMenu.visible = false;
    this.hasSelection = false;

    this.allowSelectableForNextObject = true;
    const cropped = await fabric.Image.fromURL(dataUrl);
    cropped.set({
      left: rectBounds.left,
      top: rectBounds.top,
      originX: 'left',
      originY: 'top',
      selectable: true,
      evented: true,
    });
    const insertIndex = insertionIndex >= 0 ? insertionIndex : canvas.getObjects().length;
    canvas.insertAt(insertIndex, cropped);
    canvas.setActiveObject(cropped);
    canvas.requestRenderAll();
    this.updateSelectionState(true, cropped);
    this.markUnsavedChange();
    this.alertService.success('Görsel kırpıldı.', 'Kırpma Tamam');
  }

  triggerImageUpload(): void {
    this.imageUploadInput?.nativeElement.click();
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.alertService.warning('Lütfen geçerli bir görsel dosyası seçin.', 'Geçersiz Dosya');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      void this.addImageToCanvas(dataUrl);
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  private async addImageToCanvas(dataUrl: string): Promise<void> {
    if (!this.fabricCanvas) {
      return;
    }
    this.allowSelectableForNextObject = true;
    try {
      const img = await fabric.Image.fromURL(dataUrl, { crossOrigin: 'anonymous' });
      const canvas = this.fabricCanvas!;
      const canvasWidth = canvas.getWidth();
      const canvasHeight = canvas.getHeight();
      const maxWidth = canvasWidth * 0.6;
      const maxHeight = canvasHeight * 0.6;
      const scale = Math.min(maxWidth / img.width!, maxHeight / img.height!, 1);
      img.scale(scale);
      img.set({
        left: (canvasWidth - img.getScaledWidth()) / 2,
        top: (canvasHeight - img.getScaledHeight()) / 2,
        selectable: true,
        evented: true,
      });
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.requestRenderAll();
      this.updateSelectionState(true, img);
      if (this.currentTool !== 'select') {
        this.setTool('select');
      }
      this.markUnsavedChange();
      this.alertService.success('Görsel tahtaya eklendi.', 'Görsel Hazır');
    } catch (error) {
      console.error('[PDF::addImageToCanvas] Görsel eklenemedi', error);
      this.alertService.error('Görsel yüklenirken bir hata oluştu.', 'Görsel Hatası');
    } finally {
      this.allowSelectableForNextObject = false;
    }
  }

  private updateSelectionState(state: boolean, target?: fabric.Object | null): void {
    if (this.isCropping) {
      this.updateCropMenuPosition();
      return;
    }
    this.hasSelection = state;
    if (!state || !this.fabricCanvas) {
      this.selectionMenu.visible = false;
      return;
    }
    const active = target ?? this.fabricCanvas.getActiveObject();
    if (!active) {
      this.selectionMenu.visible = false;
      return;
    }
    this.updateSelectionMenuPosition(active);
  }

  private updateSelectionMenuPosition(target: fabric.Object): void {
    const containerRect = this.pdfContainer?.nativeElement.getBoundingClientRect();
    const annotationRect = this.annotationCanvas?.nativeElement.getBoundingClientRect();
    if (!containerRect || !annotationRect) {
      this.selectionMenu.visible = false;
      return;
    }
    target.setCoords();
    const bounds = target.getBoundingRect();
    const relativeLeft = bounds.left + annotationRect.left - containerRect.left;
    const relativeTop = bounds.top + annotationRect.top - containerRect.top;
    this.selectionMenu = {
      visible: true,
      left: Math.max(8, Math.min(containerRect.width - 180, relativeLeft)),
      top: Math.max(8, relativeTop - 48),
      showCropActions: false,
      showCrop: target instanceof fabric.Image,
      showPaste: !!this.clipboardObject,
    };
  }

  private updateCropMenuPosition(): void {
    if (!this.isCropping || !this.cropRect) {
      this.selectionMenu.visible = false;
      return;
    }
    const containerRect = this.pdfContainer?.nativeElement.getBoundingClientRect();
    const annotationRect = this.annotationCanvas?.nativeElement.getBoundingClientRect();
    if (!containerRect || !annotationRect) {
      this.selectionMenu.visible = false;
      return;
    }
    this.cropRect.setCoords();
    const bounds = this.cropRect.getBoundingRect();
    const relativeLeft = bounds.left + annotationRect.left - containerRect.left;
    const relativeTop = bounds.top + annotationRect.top - containerRect.top;
    this.selectionMenu = {
      visible: true,
      left: Math.max(8, Math.min(containerRect.width - 220, relativeLeft)),
      top: Math.max(8, relativeTop - 48),
      showCropActions: true,
      showCrop: false,
      showPaste: false,
    };
  }
}
