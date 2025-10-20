import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import * as pdfjsLib from 'pdfjs-dist/webpack';
import { PDFDocument } from 'pdf-lib';
import * as fabric from 'fabric';
import type { DocumentInitParameters, PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import { AlertService } from '../../../services/alert.service';

type PdfTool = 'select' | 'pen' | 'highlighter' | 'eraser';
type BackgroundMode = 'plain' | 'grid' | 'lined';
type FabricCanvasJSON = ReturnType<fabric.Canvas['toJSON']>;
type OgrenciGruplariResponse = { success: boolean; data?: unknown; message?: string };
type ToolbarTabId = 'dosya' | 'kaydet' | 'duzenle' | 'sekiller' | 'cizgiler';
type PageImage = { page: number; dataUrl: string; width: number; height: number };
type KonuListResponse = { success: boolean; data?: DersKonuKaydi[]; konular?: DersKonuKaydi[]; message?: string };
interface DersKonuKaydi {
  id?: number;
  konu_adi: string;
  alt_konu?: string | null;
  kazanim_adi?: string | null;
}

@Component({
  selector: 'app-ders-anlatim-tahtasi',
  templateUrl: './ders-anlatim-tahasi.component.html',
  styleUrls: ['./ders-anlatim-tahasi.component.scss'],
  standalone: false,
})
export class DersAnlatimTahasiComponent implements OnDestroy, AfterViewInit, OnInit {
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
  readonly strokeSizeOptions = [2, 4, 6, 8, 10, 12, 16, 20];
  ogrenciGruplari: string[] = [];
  secilenGrup = '';
  readonly toolbarTabs: Array<{ id: ToolbarTabId; label: string }> = [
    { id: 'dosya', label: 'Dosya' },
    { id: 'kaydet', label: 'Kaydet' },
    { id: 'duzenle', label: 'Düzenle' },
    { id: 'sekiller', label: 'Şekiller' },
    { id: 'cizgiler', label: 'Çizgiler' },
  ];
  activeToolbarTab: ToolbarTabId = 'dosya';
  readonly dersAnlatimApiBase = './server/database/ders-anlatimi';
  ogrenciGruplariYukleniyor = false;
  konular: DersKonuKaydi[] = [];
  konuBasliklari: string[] = [];
  konularYukleniyor = false;
  konularHataMesaji = '';
  altKonuSecenekleri: string[] = [];
  secilenKonu = '';
  secilenAltKonu = '';
  lessonSaveInProgress = false;
  kaydetSuccessMessage = '';
  kaydetErrorMessage = '';

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
  private isRestoringAnnotations = false;
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

  constructor(private readonly alertService: AlertService, private readonly http: HttpClient) {
    console.info('[PDF::ctor] Component created');
  }

  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasPendingChanges()) {
      event.preventDefault();
      event.returnValue = 'Çalışmanız kaydedilmemiş, çizimleriniz silinecek.';
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

  ngOnInit(): void {
    this.loadOgrenciGruplari();
    this.loadKonular();
  }

  ngAfterViewInit(): void {
    this.initializeFabricCanvas();
    this.initializeBlankDocument();
  }

  setActiveTab(tabId: ToolbarTabId): void {
    this.activeToolbarTab = tabId;
    if (tabId === 'kaydet') {
      if (!this.konular.length && !this.konularYukleniyor) {
        this.loadKonular();
      }
      if (!this.ogrenciGruplari.length && !this.ogrenciGruplariYukleniyor) {
        this.loadOgrenciGruplari();
      }
    }
  }

  isActiveTab(tabId: ToolbarTabId): boolean {
    return this.activeToolbarTab === tabId;
  }

  private getAuthToken(): string {
    const storedUser = localStorage.getItem('user') ?? sessionStorage.getItem('user');
    if (!storedUser) {
      return '';
    }
    try {
      const parsed = JSON.parse(storedUser);
      return typeof parsed?.token === 'string' ? parsed.token : '';
    } catch (error) {
      console.warn('[PDF::getAuthToken] Kullanıcı verisi çözümlenemedi', error);
      return '';
    }
  }

  private buildAuthHeaders(): HttpHeaders {
    const token = this.getAuthToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  private loadKonular(): void {
    this.konularYukleniyor = true;
    this.konularHataMesaji = '';
    this.kaydetErrorMessage = '';
    this.kaydetSuccessMessage = '';
    const endpoint = `${this.dersAnlatimApiBase}/konular.php`;

    this.http
      .get<KonuListResponse>(endpoint, { headers: this.buildAuthHeaders() })
      .subscribe({
        next: (response) => {
          const rawList = Array.isArray(response?.data)
            ? response.data
            : Array.isArray(response?.konular)
            ? response.konular
            : [];

          this.konular = rawList
            .map((item) => ({
              id: (item as DersKonuKaydi)?.id,
              konu_adi: String(item?.konu_adi ?? '').trim(),
              alt_konu: item?.alt_konu ? String(item.alt_konu).trim() : null,
              kazanim_adi: item?.kazanim_adi ? String(item.kazanim_adi).trim() : null,
            }))
            .filter((item) => item.konu_adi.length > 0);

          if (!this.konular.length) {
            this.konularHataMesaji =
              response?.message ?? 'Konu listesi alınamadı. Lütfen daha sonra tekrar deneyin.';
          }

          this.konuBasliklari = Array.from(new Set(this.konular.map((item) => item.konu_adi))).sort(
            (a, b) => a.localeCompare(b, 'tr', { sensitivity: 'base' }),
          );

          this.refreshAltKonuSecenekleri();
        },
        error: (error) => {
          console.error('[PDF::loadKonular] Konular alınamadı', error);
          this.konular = [];
          this.konuBasliklari = [];
          this.konularHataMesaji = 'Konular alınırken bir hata oluştu.';
          this.konularYukleniyor = false;
        },
        complete: () => {
          this.konularYukleniyor = false;
        },
      });
  }

  onKonuChange(value: string): void {
    this.secilenKonu = value;
    this.refreshAltKonuSecenekleri();
    this.kaydetSuccessMessage = '';
    this.kaydetErrorMessage = '';
  }

  onGrupChange(): void {
    this.kaydetSuccessMessage = '';
    this.kaydetErrorMessage = '';
  }

  onAltKonuChange(): void {
    this.kaydetSuccessMessage = '';
    this.kaydetErrorMessage = '';
  }

  private refreshAltKonuSecenekleri(): void {
    if (!this.secilenKonu) {
      this.altKonuSecenekleri = [];
      this.secilenAltKonu = '';
      return;
    }

    const altlar = this.konular
      .filter((konu) => konu.konu_adi === this.secilenKonu)
      .map((konu) => konu.alt_konu || konu.kazanim_adi || '')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    this.altKonuSecenekleri = Array.from(new Set(altlar)).sort((a, b) =>
      a.localeCompare(b, 'tr', { sensitivity: 'base' }),
    );

    if (!this.altKonuSecenekleri.includes(this.secilenAltKonu)) {
      this.secilenAltKonu = '';
    }
  }

  private loadOgrenciGruplari(): void {
    this.ogrenciGruplariYukleniyor = true;
    const endpoint = `${this.dersAnlatimApiBase}/ogrenci-gruplari.php`;

    this.http
      .get<OgrenciGruplariResponse>(endpoint, { headers: this.buildAuthHeaders() })
      .subscribe({
        next: (response) => {
          if (!response?.success || !Array.isArray(response.data)) {
            console.warn('[PDF::loadOgrenciGruplari] Beklenmeyen yanıt', response);
            this.ogrenciGruplari = [];
            return;
          }

          const temizGruplar = response.data
            .map((grup) => (typeof grup === 'string' ? grup.trim() : String(grup ?? '').trim()))
            .filter((grup) => grup.length > 0);

          const benzersizGruplar = Array.from(new Set<string>(temizGruplar));
          const currentYear = new Date().getFullYear().toString();

          this.ogrenciGruplari = benzersizGruplar.sort((a, b) => {
            const aHasYear = a.includes(currentYear);
            const bHasYear = b.includes(currentYear);
            if (aHasYear && !bHasYear) {
              return -1;
            }
            if (!aHasYear && bHasYear) {
              return 1;
            }
            return a.localeCompare(b, 'tr', { sensitivity: 'base' });
          });
        },
        error: (error) => {
          console.error('[PDF::loadOgrenciGruplari] Gruplar alınamadı', error);
          this.ogrenciGruplari = [];
          this.alertService.error('Öğrenci grupları alınamadı.', 'Grup Hatası');
          this.ogrenciGruplariYukleniyor = false;
        },
        complete: () => {
          this.ogrenciGruplariYukleniyor = false;
        },
      });
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
    if (tool !== 'select') {
      this.fabricCanvas?.discardActiveObject();
      this.updateSelectionState(false);
    }
    this.configureFabricBrush();
    this.fabricCanvas?.requestRenderAll();
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

  private initializeFabricCanvas(): void {
    const canvasElement = this.annotationCanvas?.nativeElement;
    if (!canvasElement) {
      console.warn('[PDF::initializeFabricCanvas] Annotation canvas not found');
      return;
    }

    if (this.fabricCanvas) {
      this.fabricCanvas.dispose();
      this.fabricCanvas = undefined;
    }

    const pdfCanvasElement = this.pdfCanvas?.nativeElement;
    const width =
      pdfCanvasElement?.width ??
      canvasElement.width ??
      canvasElement.clientWidth ??
      1024;
    const height =
      pdfCanvasElement?.height ??
      canvasElement.height ??
      canvasElement.clientHeight ??
      Math.round(width * 1.414);

    canvasElement.width = width;
    canvasElement.height = height;

    const canvas = new fabric.Canvas(canvasElement, {
      isDrawingMode: this.currentTool !== 'select',
      selection: this.currentTool === 'select',
      preserveObjectStacking: true,
    });

    canvas.setDimensions({ width, height });
    this.fabricCanvas = canvas;

    this.applyFabricCanvasStyles(width, height);
    this.configureFabricBrush();

    canvas.on('path:created', (event) => {
      const path = (event as { path?: fabric.Path }).path;
      if (!path) {
        return;
      }

      if (this.currentTool === 'highlighter') {
        path.set({
          stroke: this.highlighterColor,
          fill: '',
          opacity: this.highlighterOpacity,
        });
        path.globalCompositeOperation = 'multiply';
      } else if (this.currentTool === 'eraser') {
        path.globalCompositeOperation = 'destination-out';
        path.set({ stroke: '#ffffff', opacity: 1 });
      } else {
        path.set({ stroke: this.penColor, opacity: 1 });
        path.globalCompositeOperation = 'source-over';
      }

      path.selectable = false;
      path.evented = false;
      this.markUnsavedChange();
    });

    canvas.on('object:added', (event) => {
      const target = (event as { target?: fabric.FabricObject }).target;
      if (!target) {
        return;
      }
      if (!this.allowSelectableForNextObject && this.currentTool !== 'select' && !this.isCropping) {
        target.selectable = false;
        target.evented = false;
      }
      this.markUnsavedChange();
    });

    canvas.on('object:modified', (event) => {
      this.markUnsavedChange();
      const target = (event as { target?: fabric.FabricObject | null }).target ?? null;
      this.updateSelectionState(true, target);
    });

    canvas.on('object:removed', () => {
      this.markUnsavedChange();
      this.updateSelectionState(false);
    });

    const handleSelection = (event: unknown) => {
      const selection = event as {
        selected?: fabric.FabricObject[];
        target?: fabric.FabricObject | null;
      };
      const target = selection.selected?.[0] ?? selection.target ?? null;
      this.updateSelectionState(true, target);
    };

    canvas.on('selection:created', handleSelection);
    canvas.on('selection:updated', handleSelection);
    canvas.on('selection:cleared', () => this.updateSelectionState(false));

    canvas.on('mouse:down', () => {
      if (this.currentTool !== 'select' && !this.isCropping) {
        this.selectionMenu.visible = false;
      }
    });

    canvas.upperCanvasEl.style.touchAction = 'none';
  }

  private configureFabricBrush(): void {
    const canvas = this.fabricCanvas;
    if (!canvas) {
      return;
    }

    const isSelectTool = this.currentTool === 'select';
    canvas.isDrawingMode = !isSelectTool;
    this.updateObjectInteractivity(isSelectTool);

    if (isSelectTool) {
      canvas.freeDrawingBrush = undefined as unknown as fabric.BaseBrush;
      canvas.upperCanvasEl.style.cursor = 'default';
      canvas.selection = true;
      return;
    }

    canvas.upperCanvasEl.style.cursor = 'crosshair';

    const FabricEraserBrush = (fabric as unknown as { EraserBrush?: new (canvas: fabric.Canvas) => fabric.BaseBrush })
      .EraserBrush;

    if (this.currentTool === 'eraser' && FabricEraserBrush) {
      const eraserBrush = new FabricEraserBrush(canvas);
      eraserBrush.width = Math.max(8, this.strokeSize * 1.5);
      canvas.freeDrawingBrush = eraserBrush;
      return;
    }

    const brush = new fabric.PencilBrush(canvas);
    const isHighlighter = this.currentTool === 'highlighter';
    const isEraserFallback = this.currentTool === 'eraser' && !FabricEraserBrush;

    brush.width = isHighlighter ? this.strokeSize * 2 : Math.max(2, this.strokeSize);
    brush.color = isHighlighter ? this.highlighterColor : this.penColor;
    (brush as any).opacity = isHighlighter ? this.highlighterOpacity : 1;
    (brush as any).globalCompositeOperation = isEraserFallback ? 'destination-out' : 'source-over';

    if (isEraserFallback) {
      brush.color = '#ffffff';
      (brush as any).opacity = 1;
    }

    canvas.freeDrawingBrush = brush;
    canvas.isDrawingMode = true;
    canvas.selection = false;
  }

  private updateObjectInteractivity(enableSelection: boolean): void {
    const canvas = this.fabricCanvas;
    if (!canvas) {
      return;
    }

    canvas.selection = enableSelection;
    canvas.getObjects().forEach((obj) => {
      if (this.isCropping && (obj === this.cropRect || obj === this.cropTarget)) {
        obj.selectable = true;
        obj.evented = true;
        return;
      }

      obj.selectable = enableSelection;
      obj.evented = enableSelection;
    });

    if (!enableSelection && !this.isCropping) {
      canvas.discardActiveObject();
      this.updateSelectionState(false);
    }
  }

  private applyFabricCanvasStyles(width: number, height: number): void {
    const canvasElement = this.annotationCanvas?.nativeElement;
    const canvas = this.fabricCanvas;
    if (!canvasElement || !canvas || !width || !height) {
      return;
    }

    const sizeStyles = {
      width: `${width}px`,
      height: `${height}px`,
    };

    Object.assign(canvasElement.style, sizeStyles, {
      position: 'absolute',
      left: '0',
      top: '0',
      zIndex: '2',
    });

    const lowerCanvas = canvas.lowerCanvasEl;
    const upperCanvas = canvas.upperCanvasEl;
    const wrapper = canvas.wrapperEl;

    if (wrapper) {
      Object.assign(wrapper.style, sizeStyles, {
        position: 'absolute',
        left: '0',
        top: '0',
        zIndex: '3',
        pointerEvents: 'auto',
      });
    }

    if (lowerCanvas) {
      Object.assign(lowerCanvas.style, sizeStyles, {
        position: 'absolute',
        left: '0',
        top: '0',
        zIndex: '3',
        pointerEvents: 'auto',
      });
    }

    if (upperCanvas) {
      Object.assign(upperCanvas.style, sizeStyles, {
        position: 'absolute',
        left: '0',
        top: '0',
        zIndex: '4',
        pointerEvents: 'auto',
      });
    }
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

    if (this.currentPage) {
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
      this.workerInitPromise = (async (): Promise<boolean> => {
        try {
          const workerUrl = '/build/pdf.worker.min.mjs';
          console.info('[PDF::ensureWorker] Fetching worker', workerUrl);
          const response = await fetch(workerUrl);
          if (!response.ok) {
            throw new Error(`Worker fetch failed: ${response.status} ${response.statusText}`);
          }

          const originalBlob = await response.blob();
          const blob =
            originalBlob.type === 'application/javascript' || originalBlob.type === 'text/javascript'
              ? originalBlob
              : new Blob([originalBlob], { type: 'text/javascript' });
          if (this.workerObjectUrl) {
            URL.revokeObjectURL(this.workerObjectUrl);
          }
          this.workerObjectUrl = URL.createObjectURL(blob);
          const worker = new Worker(this.workerObjectUrl, { type: 'module' });
          this.workerInstance = worker;
          pdfjsLib.GlobalWorkerOptions.workerPort = worker;
          this.fallbackToMainThread = false;
          console.info('[PDF::ensureWorker] Worker ready');
          return true;
        } catch (error) {
          console.error('[PDF::ensureWorker] Worker initialisation failed', error);
          this.fallbackToMainThread = true;
          if (this.workerObjectUrl) {
            URL.revokeObjectURL(this.workerObjectUrl);
            this.workerObjectUrl = undefined;
          }
          if (this.workerInstance) {
            this.workerInstance.terminate();
            this.workerInstance = undefined;
          }
          pdfjsLib.GlobalWorkerOptions.workerPort = undefined as unknown as Worker;
          return false;
        }
      })();
    }

    return this.workerInitPromise.catch((error) => {
      console.error('[PDF::ensureWorker] Worker promise rejected', error);
      this.fallbackToMainThread = true;
      this.workerInitPromise = undefined;
      return false;
    });
  }

  get canSaveLesson(): boolean {
    return Boolean(this.secilenGrup && this.secilenKonu && this.secilenAltKonu);
  }

  async downloadPdf(): Promise<void> {
    if (this.exportInProgress || this.pdfYukleniyor) {
      return;
    }

    this.exportInProgress = true;
    const previousPage = this.currentPage;

    try {
      const pageImages = await this.collectPageImages();
      if (!pageImages.length) {
        throw new Error('Dışarı aktarılacak sayfa bulunamadı.');
      }

      const pdfBytes = await this.buildPdfFromImages(pageImages);
      if (!pdfBytes.length) {
        throw new Error('PDF oluşturulamadı.');
      }

      const fileName = this.buildExportFileName(this.secilenKonu, this.secilenAltKonu);
      this.triggerFileDownload(pdfBytes, fileName);
      void this.alertService.success('PDF indirildi.', 'PDF Hazır');
      console.info('[PDF::downloadPdf] PDF downloaded', fileName);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'PDF indirirken hata oluştu.';
      console.error('[PDF::downloadPdf] Export failed', error);
      this.showError(message, 'PDF Hatası');
    } finally {
      if (previousPage !== this.currentPage) {
        await this.renderPage(previousPage);
      }
      this.exportInProgress = false;
      this.fabricCanvas?.discardActiveObject();
      this.updateSelectionState(false);
      this.setTool('pen');
      this.fabricCanvas?.renderAll();
    }
  }

  async saveLessonRecord(): Promise<void> {
    if (this.lessonSaveInProgress || this.exportInProgress) {
      return;
    }

    if (!this.canSaveLesson) {
      void this.alertService.warning('Lütfen grup, konu ve alt konuyu seçin.', 'Eksik Bilgi');
      return;
    }

    this.lessonSaveInProgress = true;
    this.exportInProgress = true;
    this.kaydetErrorMessage = '';
    this.kaydetSuccessMessage = '';

    const previousPage = this.currentPage;

    try {
      const pageImages = await this.collectPageImages();
      if (!pageImages.length) {
        throw new Error('Kaydedilecek sayfa bulunamadı.');
      }

      const pdfBytes = await this.buildPdfFromImages(pageImages);
      if (!pdfBytes.length) {
        throw new Error('PDF oluşturulamadı.');
      }

      const fileName = this.buildExportFileName(this.secilenKonu, this.secilenAltKonu);
      const arrayBuffer = new ArrayBuffer(pdfBytes.byteLength);
      const arrayView = new Uint8Array(arrayBuffer);
      arrayView.set(pdfBytes);
      const pdfBlob = new Blob([arrayBuffer], { type: 'application/pdf' });
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf', lastModified: Date.now() });

      const annotationsJson = this.buildAnnotationPayload();

      const formData = new FormData();
      formData.append('pdf_adi', fileName);
      formData.append('sayfa_sayisi', String(this.totalPages));
      formData.append('ogrenci_grubu', this.secilenGrup);
      formData.append('konu_adi', this.secilenKonu);
      formData.append('kazanim_adi', this.secilenAltKonu);
      formData.append('pdf_dosyasi', pdfFile);
      formData.append('annotation_json', annotationsJson);

      const endpoint = `${this.dersAnlatimApiBase}/kaydet.php`;

      const response = await firstValueFrom(
        this.http.post<{ success: boolean; message?: string }>(endpoint, formData, {
          headers: this.buildAuthHeaders(),
        }),
      );

      if (!response?.success) {
        throw new Error(response?.message ?? 'Kayıt işlemi başarısız oldu.');
      }

      this.kaydetSuccessMessage = response.message ?? 'Konu anlatım kaydı oluşturuldu.';
      void this.alertService.success(this.kaydetSuccessMessage, 'Kayıt Tamamlandı');
      this.clearUnsavedChanges();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Kaydetme sırasında beklenmedik bir hata oluştu.';
      this.kaydetErrorMessage = message;
      console.error('[PDF::saveLessonRecord] Save failed', error);
      this.alertService.error(message, 'Kaydetme Hatası');
    } finally {
      if (previousPage !== this.currentPage) {
        await this.renderPage(previousPage);
      }
      this.exportInProgress = false;
      this.lessonSaveInProgress = false;
      this.fabricCanvas?.discardActiveObject();
      this.updateSelectionState(false);
      this.setTool('pen');
      this.fabricCanvas?.renderAll();
    }
  }

  private async collectPageImages(): Promise<PageImage[]> {
    const total = this.totalPages;
    if (!total || total < 1) {
      return [];
    }

    this.saveCurrentAnnotations();
    const images: PageImage[] = [];

    for (let page = 1; page <= total; page++) {
      await this.renderPage(page);
      await this.restoreAnnotations(page);
      await this.waitForFabricRender();
      const combined = await this.combineCurrentPageToDataUrl();
      if (combined) {
        images.push({
          page,
          dataUrl: combined.dataUrl,
          width: combined.width,
          height: combined.height,
        });
      }
    }

    return images;
  }

  private async buildPdfFromImages(pageImages: PageImage[]): Promise<Uint8Array> {
    if (!pageImages.length) {
      return new Uint8Array();
    }

    const pdfDoc = await PDFDocument.create();

    for (const image of pageImages) {
      const imageBytes = this.dataUrlToUint8Array(image.dataUrl);
      const embedded = await pdfDoc.embedPng(imageBytes);
      const page = pdfDoc.addPage([embedded.width, embedded.height]);
      page.drawImage(embedded, {
        x: 0,
        y: 0,
        width: embedded.width,
        height: embedded.height,
      });
    }

    return await pdfDoc.save();
  }

  private buildExportFileName(konu: string, altKonu: string): string {
    const slugify = (value: string): string =>
      value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
    const parts = ['ders-anlatim'];
    if (this.secilenGrup) {
      parts.push(this.secilenGrup);
    }
    if (konu) {
      parts.push(konu);
    }
    if (altKonu) {
      parts.push(altKonu);
    }
    const base =
      parts
        .map((part) => slugify(part))
        .filter((part) => part.length > 0)
        .join('-') || 'ders-anlatim';
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
      now.getDate(),
    ).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(
      2,
      '0',
    )}`;
    return `${base}-${timestamp}.pdf`;
  }

  private buildAnnotationPayload(): string {
    const annotations = Array.from(this.annotationStates.entries()).map(([page, json]) => ({
      page,
      data: json,
    }));
    const backgrounds = Array.from(this.pageBackgrounds.entries()).map(([page, mode]) => ({
      page,
      mode,
    }));
    const metrics = Array.from(this.pageMetrics.entries()).map(([page, info]) => ({
      page,
      ...info,
    }));
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      grup: this.secilenGrup,
      konu: this.secilenKonu,
      altKonu: this.secilenAltKonu,
      totalPages: this.totalPages,
      backgrounds,
      metrics,
      annotations,
    };
    return JSON.stringify(payload);
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
    const height = Math.round(width * 1.414); // A4 oran─▒

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
    if (this.isRestoringAnnotations) {
      return;
    }
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
    this.isRestoringAnnotations = true;
    try {
      await this.runWithoutUnsavedTracking(async () => {
        this.fabricCanvas!.discardActiveObject();
        this.fabricCanvas!
          .getObjects()
          .slice()
          .forEach((obj: fabric.Object) => this.fabricCanvas?.remove(obj));
        this.fabricCanvas!.renderAll();
        this.fabricCanvas!.requestRenderAll();

        const json = this.annotationStates.get(pageNumber);
        if (!json) {
          if (this.currentTool !== 'select') {
            this.updateObjectInteractivity(false);
          } else {
            this.updateObjectInteractivity(true);
          }
          this.fabricCanvas!.renderAll();
          this.fabricCanvas!.requestRenderAll();
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
            this.fabricCanvas!.requestRenderAll();
            console.info('[PDF::restoreAnnotations] Restored page', pageNumber);
            resolve();
          });
        });
      });
    } finally {
      this.isRestoringAnnotations = false;
    }
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

  private async waitForFabricRender(): Promise<void> {
    const canvas = this.fabricCanvas;
    if (!canvas) {
      return;
    }
    await new Promise<void>((resolve) => {
      const handler = () => {
        canvas.off('after:render', handler);
        resolve();
      };
      canvas.on('after:render', handler);
      canvas.requestRenderAll();
    });
  }

  private async combineCurrentPageToDataUrl(): Promise<{ dataUrl: string; width: number; height: number } | null> {
    const pdfCanvasEl = this.pdfCanvas?.nativeElement;
    if (!pdfCanvasEl || !pdfCanvasEl.width || !pdfCanvasEl.height) {
      return null;
    }
    await this.waitForFabricRender();
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
      this.alertService.warning(
        'Panoda yapıştırılacak öğe bulunamadı.',
        'Panoya Erişim'
      );
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
      this.alertService.warning(
        'Kırpma için bir görsel seçin.',
        'Görsel Seçilmedi'
      );
      return;
    }
    if (Math.abs(active.angle ?? 0) > 0.001) {
      this.alertService.warning(
        'Döndürülmüş görsellerde kırpma desteklenmiyor.',
        'Kırpma Desteklenmiyor'
      );
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
      this.alertService.warning(
        'Lütfen geçerli bir görsel dosyası seçin.',
        'Geçersiz Dosya'
      );
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

  addShape(shape: 'rectangle' | 'circle' | 'triangle'): void {
    const canvas = this.fabricCanvas;
    if (!canvas) {
      this.alertService.warning('Çizim alanı hazır değil.', 'Şekil Eklenemedi');
      return;
    }

    const fillColor = 'rgba(79, 70, 229, 0.12)';
    const strokeColor = '#4f46e5';
    const canvasWidth = canvas.getWidth();
    const canvasHeight = canvas.getHeight();

    if (!canvasWidth || !canvasHeight) {
      return;
    }

    let shapeObject: fabric.Object;
    this.allowSelectableForNextObject = true;
    try {
      switch (shape) {
        case 'rectangle':
          shapeObject = new fabric.Rect({
            width: Math.max(160, canvasWidth * 0.3),
            height: Math.max(100, canvasHeight * 0.25),
            fill: fillColor,
            stroke: strokeColor,
            strokeWidth: 2,
            rx: 8,
            ry: 8,
            originX: 'center',
            originY: 'center',
          });
          break;
        case 'circle': {
          const radius = Math.max(60, Math.min(canvasWidth, canvasHeight) * 0.18);
          shapeObject = new fabric.Circle({
            radius,
            fill: fillColor,
            stroke: strokeColor,
            strokeWidth: 2,
            originX: 'center',
            originY: 'center',
          });
          break;
        }
        case 'triangle':
        default:
          shapeObject = new fabric.Triangle({
            width: Math.max(160, canvasWidth * 0.28),
            height: Math.max(140, canvasHeight * 0.28),
            fill: fillColor,
            stroke: strokeColor,
            strokeWidth: 2,
            originX: 'center',
            originY: 'center',
          });
          break;
      }

      shapeObject.set({
        left: canvasWidth / 2,
        top: canvasHeight / 2,
      });

      canvas.add(shapeObject);
      canvas.setActiveObject(shapeObject);
      shapeObject.setCoords();
      canvas.requestRenderAll();
      this.markUnsavedChange();
      this.setTool('select');
    } finally {
      this.allowSelectableForNextObject = false;
    }
  }

  addArrow(): void {
    const canvas = this.fabricCanvas;
    if (!canvas) {
      this.alertService.warning('Çizim alanı hazır değil.', 'Şekil Eklenemedi');
      return;
    }

    const canvasWidth = canvas.getWidth();
    const canvasHeight = canvas.getHeight();

    if (!canvasWidth || !canvasHeight) {
      return;
    }

    const strokeColor = '#4f46e5';
    this.allowSelectableForNextObject = true;
    try {
      const line = new fabric.Line([-90, 0, 90, 0], {
        stroke: strokeColor,
        strokeWidth: 4,
        selectable: false,
        evented: false,
      });

      const arrowHead = new fabric.Triangle({
        width: 28,
        height: 28,
        fill: strokeColor,
        left: 90,
        top: 0,
        originX: 'center',
        originY: 'center',
        angle: 90,
        selectable: false,
        evented: false,
      });

      const arrow = new fabric.Group([line, arrowHead], {
        left: canvasWidth / 2,
        top: canvasHeight / 2,
        originX: 'center',
        originY: 'center',
      });

      canvas.add(arrow);
      canvas.setActiveObject(arrow);
      arrow.setCoords();
      canvas.requestRenderAll();
      this.markUnsavedChange();
      this.setTool('select');
    } finally {
      this.allowSelectableForNextObject = false;
    }
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
      console.error('[PDF::addImageToCanvas] G├Ârsel eklenemedi', error);
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

