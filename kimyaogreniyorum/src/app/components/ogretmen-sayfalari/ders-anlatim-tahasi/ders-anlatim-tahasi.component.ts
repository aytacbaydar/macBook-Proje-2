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
export class DersAnlatimTahasiComponent
  implements OnDestroy, AfterViewInit, OnInit
{
  @ViewChild('pdfCanvas', { static: false })
  pdfCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('annotationCanvas', { static: false })
  annotationCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('pdfContainer', { static: false })
  pdfContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('imageUploadInput', { static: false })
  imageUploadInput?: ElementRef<HTMLInputElement>;
  @ViewChild('toolbarRoot', { static: false })
  toolbarRoot?: ElementRef<HTMLDivElement>;

  pdfYukleniyor = false;
  pdfHataMesaji = '';

  currentPage = 1;
  totalPages = 1;

  currentTool: PdfTool = 'pen';
  backgroundMode: BackgroundMode = 'plain';
  penColor = '#000000';
  highlighterColor = '#ffff00';
  penSize = 4;
  eraserSize = 12;
  highlighterOpacity = 0.35;
  readonly penColorOptions = ['#000000', '#0000FF', '#FF0000', '#008000'];
  readonly penSizeOptions = [2, 3, 4, 5, 6, 8, 10, 12, 14, 16];
  readonly eraserSizeOptions = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32];
  zoomLevel = 1;
  readonly minZoom = 0.5;
  readonly maxZoom = 3;
  readonly zoomStep = 0.1;
  ogrenciGruplari: string[] = [];
  secilenGrup = '';
  readonly toolbarTabs: Array<{ id: ToolbarTabId; label: string }> = [
    { id: 'dosya', label: 'Dosya' },
    { id: 'kaydet', label: 'Kaydet' },
    { id: 'duzenle', label: 'Düzenle' },
    { id: 'sekiller', label: 'Şekiller' },
    { id: 'cizgiler', label: 'Çizgiler' },
  ];

  readonly toolbarTabIcons: Record<ToolbarTabId, string> = {
    dosya: 'bi-folder2-open',
    kaydet: 'bi-cloud-arrow-down',
    duzenle: 'bi-sliders',
    sekiller: 'bi-shapes',
    cizgiler: 'bi-brush',
  };
  kaydetPanelMode: 'lesson' | 'attendance' = 'lesson';
  attendanceModalOpen = false;
  toolbarCollapsed = false;
  toolbarPosition = { top: 16, left: 16 };
  toolbarMenuOpen = false;
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
  private pageMetrics = new Map<
    number,
    {
      canvasWidth: number;
      canvasHeight: number;
      pdfWidth?: number;
      pdfHeight?: number;
    }
  >();
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
  private brandingLogoImage?: HTMLImageElement | null;
  private brandingLogoPromise?: Promise<HTMLImageElement | null>;
  private readonly brandingHeaderText = 'Ayta\u00E7 Baydar || Kimya \u00D6\u011Fretmeni';
  private readonly brandingLogoSrc = 'assets/images/logo-turuncu.png';

  clipboardObject?: fabric.Object;
  private clipboardBasePosition: { left: number; top: number } | null = null;
  private clipboardNextOffset = { x: 32, y: 32 };
  private readonly clipboardOffsetStep = 32;
  private readonly clipboardOffsetMax = 160;
  private baseDisplaySize = { width: 0, height: 0 };
  private toolbarSize = { width: 0, height: 0 };
  private readonly toolbarMargin = 12;
  toolbarDrag = {
    active: false,
    offsetX: 0,
    offsetY: 0,
    pointerId: null as number | null,
    element: null as HTMLElement | null,
  };
  isShiftPressed = false;
  private straightLineStart: fabric.Point | null = null;
  private straightLinePreview?: fabric.Line;
  private readonly canvasMouseDownHandler = (event: fabric.TPointerEventInfo<fabric.TPointerEvent>) =>
    this.handleCanvasMouseDown(event);
  private readonly canvasMouseMoveHandler = (event: fabric.TPointerEventInfo<fabric.TPointerEvent>) =>
    this.handleCanvasMouseMove(event);
  private readonly canvasMouseUpHandler = (event: fabric.TPointerEventInfo<fabric.TPointerEvent>) =>
    this.handleCanvasMouseUp(event);

  constructor(
    private readonly alertService: AlertService,
    private readonly http: HttpClient
  ) {
    console.info('[PDF::ctor] Component created');
  }

  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasPendingChanges()) {
      event.preventDefault();
      event.returnValue = 'Ã‡alÄ±ÅŸmanÄ±z kaydedilmemiÅŸ, Ã§izimleriniz silinecek.';
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

  toggleToolbarCollapsed(): void {
    this.toolbarCollapsed = !this.toolbarCollapsed;
    if (this.toolbarCollapsed) {
      this.toolbarMenuOpen = false;
    }
    setTimeout(() => this.refreshToolbarMetrics(), 0);
  }

  toggleToolbarMenu(event?: Event): void {
    event?.stopPropagation();
    this.toolbarMenuOpen = !this.toolbarMenuOpen;
    setTimeout(() => this.refreshToolbarMetrics(), 0);
  }

  selectToolbarTab(tabId: ToolbarTabId, event?: Event): void {
    event?.stopPropagation();
    this.setActiveTab(tabId);
    this.toolbarMenuOpen = false;
    setTimeout(() => this.refreshToolbarMetrics(), 0);
  }

  getActiveTabLabel(): string {
    const active = this.toolbarTabs.find((tab) => tab.id === this.activeToolbarTab);
    return active?.label ?? 'SeÃ§enekler';
  }

  getToolbarTabIcon(tabId: ToolbarTabId): string {
    return this.toolbarTabIcons[tabId] ?? 'bi-circle';
  }

  onToolbarDragStart(event: PointerEvent): void {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }
    event.preventDefault();
    this.toolbarMenuOpen = false;
    const el = this.toolbarRoot?.nativeElement;
    if (el) {
      const rect = el.getBoundingClientRect();
      this.toolbarSize = {
        width: rect.width,
        height: rect.height,
      };
    }
    this.toolbarDrag.active = true;
    this.toolbarDrag.offsetX = event.clientX - this.toolbarPosition.left;
    this.toolbarDrag.offsetY = event.clientY - this.toolbarPosition.top;
    this.toolbarDrag.pointerId = event.pointerId;
    this.toolbarDrag.element = (event.currentTarget as HTMLElement) ?? null;
    if (this.toolbarDrag.element?.setPointerCapture) {
      try {
        this.toolbarDrag.element.setPointerCapture(event.pointerId);
      } catch {
        /* noop */
      }
    }
  }

  @HostListener('window:pointermove', ['$event'])
  onWindowPointerMove(event: PointerEvent): void {
    if (!this.toolbarDrag.active || this.toolbarDrag.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    this.updateToolbarPosition(
      event.clientX - this.toolbarDrag.offsetX,
      event.clientY - this.toolbarDrag.offsetY
    );
  }

  @HostListener('window:keydown', ['$event'])
  handleGlobalKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Shift') {
      this.isShiftPressed = true;
      if (this.currentTool !== 'select' && this.fabricCanvas) {
        this.fabricCanvas.isDrawingMode = !this.isShiftPressed;
      }
    }
  }

  @HostListener('window:keyup', ['$event'])
  handleGlobalKeyUp(event: KeyboardEvent): void {
    if (event.key === 'Shift') {
      this.isShiftPressed = false;
      this.cleanupStraightLinePreview();
      if (this.fabricCanvas && this.currentTool !== 'select') {
        this.fabricCanvas.isDrawingMode = true;
      }
    }
  }

  @HostListener('window:pointerup', ['$event'])
  onWindowPointerUp(event: PointerEvent): void {
    if (!this.toolbarDrag.active || this.toolbarDrag.pointerId !== event.pointerId) {
      return;
    }
    this.finishToolbarDrag();
  }

  @HostListener('window:pointercancel', ['$event'])
  onWindowPointerCancel(event: PointerEvent): void {
    if (!this.toolbarDrag.active || this.toolbarDrag.pointerId !== event.pointerId) {
      return;
    }
    this.finishToolbarDrag();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.toolbarMenuOpen) {
      return;
    }
    const root = this.toolbarRoot?.nativeElement;
    if (root && event.target instanceof Node && root.contains(event.target)) {
      return;
    }
    this.toolbarMenuOpen = false;
  }

  private updateToolbarPosition(left: number, top: number): void {
    if (typeof window === 'undefined') {
      this.toolbarPosition.left = left;
      this.toolbarPosition.top = top;
      return;
    }
    const margin = this.toolbarMargin;
    const width = this.toolbarSize.width || 1;
    const height = this.toolbarSize.height || 1;
    const maxLeft = Math.max(margin, window.innerWidth - width - margin);
    const maxTop = Math.max(margin, window.innerHeight - height - margin);
    this.toolbarPosition.left = this.clamp(left, margin, maxLeft);
    this.toolbarPosition.top = this.clamp(top, margin, maxTop);
  }

  private refreshToolbarMetrics(): void {
    if (typeof window === 'undefined') {
      return;
    }
    const update = () => {
      const el = this.toolbarRoot?.nativeElement;
      if (!el) {
        return;
      }
      const rect = el.getBoundingClientRect();
      this.toolbarSize = {
        width: rect.width,
        height: rect.height,
      };
      this.clampToolbarWithinViewport();
    };
    if ('requestAnimationFrame' in window) {
      window.requestAnimationFrame(update);
    } else {
      setTimeout(update, 0);
    }
  }

  private clampToolbarWithinViewport(): void {
    if (typeof window === 'undefined') {
      return;
    }
    const margin = this.toolbarMargin;
    const width = this.toolbarSize.width || 1;
    const height = this.toolbarSize.height || 1;
    const maxLeft = Math.max(margin, window.innerWidth - width - margin);
    const maxTop = Math.max(margin, window.innerHeight - height - margin);
    this.toolbarPosition.left = this.clamp(this.toolbarPosition.left, margin, maxLeft);
    this.toolbarPosition.top = this.clamp(this.toolbarPosition.top, margin, maxTop);
  }

  private finishToolbarDrag(): void {
    if (!this.toolbarDrag.active) {
      return;
    }
    const { element, pointerId } = this.toolbarDrag;
    if (pointerId !== null && element?.releasePointerCapture) {
      try {
        element.releasePointerCapture(pointerId);
      } catch {
        /* noop */
      }
    }
    this.toolbarDrag.active = false;
    this.toolbarDrag.pointerId = null;
    this.toolbarDrag.element = null;
    this.refreshToolbarMetrics();
  }

  private cleanupStraightLinePreview(): void {
    if (this.straightLinePreview && this.fabricCanvas) {
      this.fabricCanvas.remove(this.straightLinePreview);
      this.fabricCanvas.requestRenderAll();
    }
    this.straightLinePreview = undefined;
    this.straightLineStart = null;
  }

  @HostListener('document:keydown.escape', ['$event'])
  handleEscapeKey(event: KeyboardEvent): void {
    if (!this.attendanceModalOpen) {
      return;
    }
    event.preventDefault();
    this.closeAttendanceModal();
  }

  private handleCanvasMouseDown(event: fabric.TPointerEventInfo<fabric.TPointerEvent>): void {
    if (!this.fabricCanvas) {
      return;
    }
    if (this.currentTool !== 'pen' || !this.isShiftPressed) {
      return;
    }
    const canvas = this.fabricCanvas;
    const pointer = canvas.getPointer(event.e as fabric.TPointerEvent);
    this.cleanupStraightLinePreview();
    this.straightLineStart = new fabric.Point(pointer.x, pointer.y);
    this.straightLinePreview = new fabric.Line(
      [pointer.x, pointer.y, pointer.x, pointer.y],
      {
        stroke: this.penColor,
        strokeWidth: Math.max(1, this.penSize),
        selectable: false,
        evented: false,
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
      }
    );
    canvas.isDrawingMode = false;
    canvas.add(this.straightLinePreview);
    canvas.requestRenderAll();
    const originalEvent = event.e as unknown as {
      preventDefault?: () => void;
      stopPropagation?: () => void;
    };
    originalEvent?.preventDefault?.();
    originalEvent?.stopPropagation?.();
  }

  private handleCanvasMouseMove(event: fabric.TPointerEventInfo<fabric.TPointerEvent>): void {
    if (!this.fabricCanvas || !this.straightLineStart || !this.straightLinePreview) {
      return;
    }
    const canvas = this.fabricCanvas;
    const pointer = canvas.getPointer(event.e as fabric.TPointerEvent);
    let endX = pointer.x;
    let endY = pointer.y;
    const dx = endX - this.straightLineStart.x;
    const dy = endY - this.straightLineStart.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      endY = this.straightLineStart.y;
    } else {
      endX = this.straightLineStart.x;
    }
    this.straightLinePreview.set({
      x1: this.straightLineStart.x,
      y1: this.straightLineStart.y,
      x2: endX,
      y2: endY,
    });
    this.straightLinePreview.setCoords();
    canvas.requestRenderAll();
  }

  private handleCanvasMouseUp(event: fabric.TPointerEventInfo<fabric.TPointerEvent>): void {
    if (!this.fabricCanvas || !this.straightLineStart) {
      return;
    }
    const canvas = this.fabricCanvas;
    if (!this.straightLinePreview) {
      this.straightLineStart = null;
      return;
    }
    const pointer = canvas.getPointer(event.e as fabric.TPointerEvent);
    let endX = pointer.x;
    let endY = pointer.y;
    const dx = endX - this.straightLineStart.x;
    const dy = endY - this.straightLineStart.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      endY = this.straightLineStart.y;
    } else {
      endX = this.straightLineStart.x;
    }
    this.straightLinePreview.set({
      x1: this.straightLineStart.x,
      y1: this.straightLineStart.y,
      x2: endX,
      y2: endY,
      stroke: this.penColor,
      strokeWidth: Math.max(1, this.penSize),
      selectable: this.currentTool === 'select',
      evented: this.currentTool === 'select',
    });
    this.straightLinePreview.setCoords();
    canvas.requestRenderAll();
    this.markUnsavedChange();
    this.straightLinePreview = undefined;
    this.straightLineStart = null;
    if (!this.isShiftPressed && this.currentTool !== 'select') {
      canvas.isDrawingMode = true;
    }
  }

  private clamp(value: number, min: number, max: number): number {
    if (value < min) {
      return min;
    }
    if (value > max) {
      return max;
    }
    return value;
  }

  ngOnInit(): void {
    this.loadOgrenciGruplari();
    this.loadKonular();
  }

  ngAfterViewInit(): void {
    this.initializeFabricCanvas();
    this.initializeBlankDocument();
    this.refreshToolbarMetrics();
  }

  setActiveTab(tabId: ToolbarTabId): void {
    this.activeToolbarTab = tabId;
    this.toolbarMenuOpen = false;
    if (tabId === 'kaydet') {
      if (!this.konular.length && !this.konularYukleniyor) {
        this.loadKonular();
      }
      if (!this.ogrenciGruplari.length && !this.ogrenciGruplariYukleniyor) {
        this.loadOgrenciGruplari();
      }
    } else {
      this.kaydetPanelMode = 'lesson';
      this.closeAttendanceModal();
    }
    setTimeout(() => this.refreshToolbarMetrics(), 0);
  }

  setKaydetPanelMode(mode: 'lesson' | 'attendance'): void {
    this.kaydetPanelMode = mode;
    if (mode === 'attendance') {
      this.attendanceModalOpen = true;
    } else {
      this.closeAttendanceModal();
    }
    setTimeout(() => this.refreshToolbarMetrics(), 0);
  }

  openAttendanceModal(): void {
    if (this.attendanceModalOpen) {
      return;
    }
    this.attendanceModalOpen = true;
  }

  closeAttendanceModal(): void {
    if (!this.attendanceModalOpen) {
      return;
    }
    this.attendanceModalOpen = false;
  }

  isActiveTab(tabId: ToolbarTabId): boolean {
    return this.activeToolbarTab === tabId;
  }

  private getAuthToken(): string {
    const storedUser =
      localStorage.getItem('user') ?? sessionStorage.getItem('user');
    if (!storedUser) {
      return '';
    }
    try {
      const parsed = JSON.parse(storedUser);
      return typeof parsed?.token === 'string' ? parsed.token : '';
    } catch (error) {
      console.warn('[PDF::getAuthToken] KullanÄ±cÄ± verisi Ã§Ã¶zÃ¼mlenemedi', error);
      return '';
    }
  }

  private buildAuthHeaders(): HttpHeaders {
    const token = this.getAuthToken();
    return token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();
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
              kazanim_adi: item?.kazanim_adi
                ? String(item.kazanim_adi).trim()
                : null,
            }))
            .filter((item) => item.konu_adi.length > 0);

          if (!this.konular.length) {
            this.konularHataMesaji =
              response?.message ??
              'Konu listesi alÄ±namadÄ±. LÃ¼tfen daha sonra tekrar deneyin.';
          }

          this.konuBasliklari = Array.from(
            new Set(this.konular.map((item) => item.konu_adi))
          ).sort((a, b) => a.localeCompare(b, 'tr', { sensitivity: 'base' }));

          this.refreshAltKonuSecenekleri();
        },
        error: (error) => {
          console.error('[PDF::loadKonular] Konular alÄ±namadÄ±', error);
          this.konular = [];
          this.konuBasliklari = [];
          this.konularHataMesaji = 'Konular alÄ±nÄ±rken bir hata oluÅŸtu.';
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
      a.localeCompare(b, 'tr', { sensitivity: 'base' })
    );

    if (!this.altKonuSecenekleri.includes(this.secilenAltKonu)) {
      this.secilenAltKonu = '';
    }
  }

  private loadOgrenciGruplari(): void {
    this.ogrenciGruplariYukleniyor = true;
    const endpoint = `${this.dersAnlatimApiBase}/ogrenci-gruplari.php`;

    this.http
      .get<OgrenciGruplariResponse>(endpoint, {
        headers: this.buildAuthHeaders(),
      })
      .subscribe({
        next: (response) => {
          if (!response?.success || !Array.isArray(response.data)) {
            console.warn(
              '[PDF::loadOgrenciGruplari] Beklenmeyen yanÄ±t',
              response
            );
            this.ogrenciGruplari = [];
            return;
          }

          const temizGruplar = response.data
            .map((grup) =>
              typeof grup === 'string' ? grup.trim() : String(grup ?? '').trim()
            )
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
          console.error('[PDF::loadOgrenciGruplari] Gruplar alÄ±namadÄ±', error);
          this.ogrenciGruplari = [];
          this.alertService.error('Ã–ÄŸrenci gruplarÄ± alÄ±namadÄ±.', 'Grup HatasÄ±');
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
      console.info(
        '[PDF::ngOnDestroy] Revoking worker blob URL',
        this.workerObjectUrl
      );
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
    console.info(
      '[PDF::onPdfSec] File selection event',
      input.files?.[0]?.name
    );
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
      console.info('[PDF::onPdfSec] Worker status', {
        workerReady,
        fallback: this.fallbackToMainThread,
      });

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
      this.showError('PDF yÃ¼klenirken bir hata oluÅŸtu.', 'PDF HatasÄ±');
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
    this.cleanupStraightLinePreview();
    this.fabricCanvas?.requestRenderAll();
  }

  setPenColor(color: string): void {
    this.penColor = color;
    console.info('[PDF::setPenColor] Selected color', color);
    if (this.currentTool === 'pen') {
      this.configureFabricBrush();
    }
  }

  onPenSizeChange(size: number): void {
    this.penSize = Number(size);
    if (this.currentTool === 'pen' || this.currentTool === 'highlighter') {
      this.configureFabricBrush();
    }
  }

  onEraserSizeChange(size: number): void {
    this.eraserSize = Number(size);
    if (this.currentTool === 'eraser') {
      this.configureFabricBrush();
    }
  }

  get zoomPercent(): number {
    return Math.round(this.zoomLevel * 100);
  }

  zoomIn(): void {
    this.setZoom(this.zoomLevel + this.zoomStep);
  }

  zoomOut(): void {
    this.setZoom(this.zoomLevel - this.zoomStep);
  }

  resetZoom(): void {
    this.setZoom(1);
  }

  setZoom(level: number): void {
    const next = this.clamp(Number(level), this.minZoom, this.maxZoom);
    if (!Number.isFinite(next)) {
      return;
    }
    const normalized = Number(next.toFixed(2));
    if (Math.abs(normalized - this.zoomLevel) < 0.001) {
      return;
    }
    this.zoomLevel = normalized;
    this.applyZoom();
  }

  private setBaseDisplaySize(width: number, height: number): void {
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0
    ) {
      return;
    }
    this.baseDisplaySize = {
      width,
      height,
    };
    this.applyZoom();
  }

  private applyZoom(): void {
    const baseWidth = this.baseDisplaySize.width;
    const baseHeight = this.baseDisplaySize.height;
    if (!baseWidth || !baseHeight) {
      return;
    }
    const displayWidth = baseWidth * this.zoomLevel;
    const displayHeight = baseHeight * this.zoomLevel;
    this.updateCanvasDisplaySize(displayWidth, displayHeight);
  }

  private updateCanvasDisplaySize(width: number, height: number): void {
    const pdfCanvasEl = this.pdfCanvas?.nativeElement;
    if (pdfCanvasEl) {
      pdfCanvasEl.style.width = `${width}px`;
      pdfCanvasEl.style.height = `${height}px`;
      pdfCanvasEl.style.maxWidth = 'none';
      pdfCanvasEl.style.maxHeight = 'none';
    }

    const annotationEl = this.annotationCanvas?.nativeElement;
    if (annotationEl) {
      annotationEl.style.width = `${width}px`;
      annotationEl.style.height = `${height}px`;
      annotationEl.style.maxWidth = 'none';
      annotationEl.style.maxHeight = 'none';
    }

    if (this.fabricCanvas) {
      const wrapper = this.fabricCanvas.wrapperEl;
      const lower = this.fabricCanvas.lowerCanvasEl;
      const upper = this.fabricCanvas.upperCanvasEl;
      [wrapper, lower, upper].forEach((el) => {
        if (el) {
          el.style.width = `${width}px`;
          el.style.height = `${height}px`;
          el.style.maxWidth = 'none';
          el.style.maxHeight = 'none';
        }
      });
      this.fabricCanvas.calcOffset();
      this.fabricCanvas.requestRenderAll();
    }
  }

  private resetClipboardOffset(): void {
    this.clipboardNextOffset = {
      x: this.clipboardOffsetStep,
      y: this.clipboardOffsetStep,
    };
  }

  private getNextClipboardOffset(): { x: number; y: number } {
    const offset = { ...this.clipboardNextOffset };
    const nextX = offset.x + this.clipboardOffsetStep;
    const nextY = offset.y + this.clipboardOffsetStep;
    if (nextX > this.clipboardOffsetMax || nextY > this.clipboardOffsetMax) {
      this.resetClipboardOffset();
    } else {
      this.clipboardNextOffset = { x: nextX, y: nextY };
    }
    return offset;
  }

  private ensureObjectWithinCanvas(target: fabric.Object): void {
    const canvas = this.fabricCanvas;
    if (!canvas) {
      return;
    }
    target.setCoords();
    const bounds = target.getBoundingRect();
    const canvasWidth = canvas.getWidth();
    const canvasHeight = canvas.getHeight();
    let left = target.left ?? 0;
    let top = target.top ?? 0;
    if (bounds.left < 0) {
      left -= bounds.left;
    }
    if (bounds.top < 0) {
      top -= bounds.top;
    }
    if (bounds.left + bounds.width > canvasWidth) {
      left -= bounds.left + bounds.width - canvasWidth;
    }
    if (bounds.top + bounds.height > canvasHeight) {
      top -= bounds.top + bounds.height - canvasHeight;
    }
    target.set({ left, top });
    target.setCoords();
  }

  async setBackground(mode: BackgroundMode): Promise<void> {
    this.backgroundMode = mode;
    if (!this.currentPage) {
      return;
    }
    this.pageBackgrounds.set(this.currentPage, mode);
    console.info(
      '[PDF::setBackground] Mode changed',
      mode,
      'page',
      this.currentPage
    );
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

  // Fabric.js canvas ayarlarÄ±
private initializeFabricCanvas(): void {
  const canvasElement = this.annotationCanvas?.nativeElement;
  if (!canvasElement) return;

  if (this.fabricCanvas) {
    this.fabricCanvas.dispose();
    this.fabricCanvas = undefined;
  }

  // ğŸ“ YÃ¼ksek Ã§Ã¶zÃ¼nÃ¼rlÃ¼klÃ¼ A4 boyutunda canvas
  const A4_WIDTH_PX = 2480; // 210mm @ 300DPI
  const A4_HEIGHT_PX = 3508; // 297mm @ 300DPI

  canvasElement.width = A4_WIDTH_PX;
  canvasElement.height = A4_HEIGHT_PX;

  const canvas = new fabric.Canvas(canvasElement, {
    isDrawingMode: this.currentTool !== 'select',
    selection: this.currentTool === 'select',
    preserveObjectStacking: true,
  });

  canvas.setDimensions({ width: A4_WIDTH_PX, height: A4_HEIGHT_PX });
  this.fabricCanvas = canvas;

  this.applyFabricCanvasStyles(A4_WIDTH_PX, A4_HEIGHT_PX);
  this.configureFabricBrush();
  this.attachStraightLineHandlers();

  canvas.on('path:created', () => this.markUnsavedChange());
  canvas.on('object:added', () => this.markUnsavedChange());
  canvas.on('object:modified', () => this.markUnsavedChange());
  canvas.on('object:removed', () => this.markUnsavedChange());
}

// Fabric.js canvas ayarlarÄ± son


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

    const FabricEraserBrush = (
      fabric as unknown as {
        EraserBrush?: new (canvas: fabric.Canvas) => fabric.BaseBrush;
      }
    ).EraserBrush;

    if (this.currentTool === 'eraser' && FabricEraserBrush) {
      const eraserBrush = new FabricEraserBrush(canvas);
      eraserBrush.width = Math.max(2, this.eraserSize);
      canvas.freeDrawingBrush = eraserBrush;
      return;
    }

    const brush = new fabric.PencilBrush(canvas);
    const isHighlighter = this.currentTool === 'highlighter';
    const isEraserFallback =
      this.currentTool === 'eraser' && !FabricEraserBrush;

    const basePenSize = Math.max(1, this.penSize);
    brush.width = isHighlighter
      ? Math.max(2, basePenSize * 1.8)
      : basePenSize;
    brush.color = isHighlighter ? this.highlighterColor : this.penColor;
    (brush as any).opacity = isHighlighter ? this.highlighterOpacity : 1;
    (brush as any).globalCompositeOperation = isEraserFallback
      ? 'destination-out'
      : 'source-over';

    if (isEraserFallback) {
      brush.color = '#ffffff';
      (brush as any).opacity = 1;
      brush.width = Math.max(2, this.eraserSize);
    }

    canvas.freeDrawingBrush = brush;
    canvas.isDrawingMode = true;
    canvas.selection = false;
  }

  private attachStraightLineHandlers(): void {
    const canvas = this.fabricCanvas;
    if (!canvas) {
      return;
    }
    canvas.off('mouse:down', this.canvasMouseDownHandler);
    canvas.off('mouse:move', this.canvasMouseMoveHandler);
    canvas.off('mouse:up', this.canvasMouseUpHandler);
    canvas.on('mouse:down', this.canvasMouseDownHandler);
    canvas.on('mouse:move', this.canvasMouseMoveHandler);
    canvas.on('mouse:up', this.canvasMouseUpHandler);
  }

  private updateObjectInteractivity(enableSelection: boolean): void {
    const canvas = this.fabricCanvas;
    if (!canvas) {
      return;
    }

    canvas.selection = enableSelection;
    canvas.getObjects().forEach((obj) => {
      if (
        this.isCropping &&
        (obj === this.cropRect || obj === this.cropTarget)
      ) {
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


  // PDF sayfasÄ±nÄ± render etme
  @HostListener('window:resize')
  onWindowResize(): void {
    this.refreshToolbarMetrics();
    if (this.currentPage) {
      void this.renderPage(this.currentPage);
    }
  }

private async renderPage(pageNumber: number): Promise<void> {
  if (this.renderInProgress) {
    this.pendingPage = pageNumber;
    return;
  }

  const pdfCanvasEl = this.pdfCanvas?.nativeElement;
  if (!pdfCanvasEl || !this.annotationCanvas?.nativeElement) return;

  this.saveCurrentAnnotations();
  this.renderInProgress = true;

  const isPdfRender = !this.blankDocument && !!this.pdfDoc;
  this.pdfYukleniyor = isPdfRender;

  try {
    const pdfCtx = pdfCanvasEl.getContext('2d');
    if (!pdfCtx) return;

    if (!this.blankDocument && this.pdfDoc) {
      const page = await this.pdfDoc.getPage(pageNumber);

      const deviceScale = Math.max(window.devicePixelRatio, 2);
      const baseScale = this.renderScale * deviceScale;
      const viewport = page.getViewport({ scale: baseScale });

      pdfCanvasEl.width = viewport.width;
      pdfCanvasEl.height = viewport.height;

      const cssWidth = viewport.width / deviceScale;
      const cssHeight = viewport.height / deviceScale;
      const containerWidth =
        this.pdfContainer?.nativeElement.clientWidth ?? cssWidth;
      const fitScale =
        containerWidth > 0 ? containerWidth / cssWidth : 1;
      const baseDisplayWidth = cssWidth * fitScale;
      const baseDisplayHeight = cssHeight * fitScale;

      const renderContext = {
        canvasContext: pdfCtx,
        viewport,
        canvas: pdfCanvasEl,
        transform: [1, 0, 0, 1, 0, 0],
      };

      pdfCtx.setTransform(1, 0, 0, 1, 0, 0);
      pdfCtx.clearRect(0, 0, pdfCanvasEl.width, pdfCanvasEl.height);

      await page.render(renderContext).promise;

      this.prepareAnnotationCanvas(viewport.width, viewport.height);
      this.pageMetrics.set(pageNumber, {
        canvasWidth: viewport.width,
        canvasHeight: viewport.height,
        pdfWidth: baseDisplayWidth,
        pdfHeight: baseDisplayHeight,
      });
      this.setBaseDisplaySize(baseDisplayWidth, baseDisplayHeight);
    } else {
      this.blankDocument = true;
      const pdfCtx2 = pdfCanvasEl.getContext('2d');
      if (pdfCtx2) this.drawBlankBackground(pageNumber, pdfCanvasEl, pdfCtx2);
    }

    this.currentPage = pageNumber;
    await this.restoreAnnotations(pageNumber);
    this.configureFabricBrush();
  } catch (error) {
    console.error('[PDF::renderPage] Error:', error);
    this.showError('Sayfa Ã§izilirken hata oluÅŸtu.', 'Ã‡izim HatasÄ±');
  } finally {
    this.renderInProgress = false;
    this.pdfYukleniyor = false;
    if (this.pendingPage && this.pendingPage !== pageNumber) {
      const next = this.pendingPage;
      this.pendingPage = undefined;
      await this.renderPage(next);
    } else {
      this.pendingPage = undefined;
    }
  }
}


  // PDF sayfasÄ±nÄ± render etme son




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
            throw new Error(
              `Worker fetch failed: ${response.status} ${response.statusText}`
            );
          }

          const originalBlob = await response.blob();
          const blob =
            originalBlob.type === 'application/javascript' ||
            originalBlob.type === 'text/javascript'
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
          console.error(
            '[PDF::ensureWorker] Worker initialisation failed',
            error
          );
          this.fallbackToMainThread = true;
          if (this.workerObjectUrl) {
            URL.revokeObjectURL(this.workerObjectUrl);
            this.workerObjectUrl = undefined;
          }
          if (this.workerInstance) {
            this.workerInstance.terminate();
            this.workerInstance = undefined;
          }
          pdfjsLib.GlobalWorkerOptions.workerPort =
            undefined as unknown as Worker;
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
        throw new Error('DÄ±ÅŸarÄ± aktarÄ±lacak sayfa bulunamadÄ±.');
      }

      const pdfBytes = await this.buildPdfFromImages(pageImages);
      if (!pdfBytes.length) {
        throw new Error('PDF oluÅŸturulamadÄ±.');
      }

      const fileName = this.buildExportFileName(
        this.secilenKonu,
        this.secilenAltKonu
      );
      this.triggerFileDownload(pdfBytes, fileName);
      void this.alertService.success('PDF indirildi.', 'PDF HazÄ±r');
      console.info('[PDF::downloadPdf] PDF downloaded', fileName);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'PDF indirirken hata oluÅŸtu.';
      console.error('[PDF::downloadPdf] Export failed', error);
      this.showError(message, 'PDF HatasÄ±');
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
      void this.alertService.warning(
        'LÃ¼tfen grup, konu ve alt konuyu seÃ§in.',
        'Eksik Bilgi'
      );
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
        throw new Error('Kaydedilecek sayfa bulunamadÄ±.');
      }

      const pdfBytes = await this.buildPdfFromImages(pageImages);
      if (!pdfBytes.length) {
        throw new Error('PDF oluÅŸturulamadÄ±.');
      }

      const fileName = this.buildExportFileName(
        this.secilenKonu,
        this.secilenAltKonu
      );
      const arrayBuffer = new ArrayBuffer(pdfBytes.byteLength);
      const arrayView = new Uint8Array(arrayBuffer);
      arrayView.set(pdfBytes);
      const pdfBlob = new Blob([arrayBuffer], { type: 'application/pdf' });
      const pdfFile = new File([pdfBlob], fileName, {
        type: 'application/pdf',
        lastModified: Date.now(),
      });

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
        this.http.post<{ success: boolean; message?: string }>(
          endpoint,
          formData,
          {
            headers: this.buildAuthHeaders(),
          }
        )
      );

      if (!response?.success) {
        throw new Error(response?.message ?? 'KayÄ±t iÅŸlemi baÅŸarÄ±sÄ±z oldu.');
      }

      this.kaydetSuccessMessage =
        response.message ?? 'Konu anlatÄ±m kaydÄ± oluÅŸturuldu.';
      void this.alertService.success(
        this.kaydetSuccessMessage,
        'KayÄ±t TamamlandÄ±'
      );
      this.clearUnsavedChanges();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Kaydetme sÄ±rasÄ±nda beklenmedik bir hata oluÅŸtu.';
      this.kaydetErrorMessage = message;
      console.error('[PDF::saveLessonRecord] Save failed', error);
      this.alertService.error(message, 'Kaydetme HatasÄ±');
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
      const combined = await this.combineCurrentPageToDataUrl(page, total);
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


  // pdf oluÅŸturma
  private async buildPdfFromImages(pageImages: PageImage[]): Promise<Uint8Array> {
  if (!pageImages.length) return new Uint8Array();

  const pdfDoc = await PDFDocument.create();

  // A4 olcileri (point)
  const A4_WIDTH_PT = 595.28;
  const A4_HEIGHT_PT = 841.89;
  const SAFE_MARGIN_PT = 24;
  const MAX_DRAW_WIDTH = A4_WIDTH_PT - SAFE_MARGIN_PT * 2;
  const MAX_DRAW_HEIGHT = A4_HEIGHT_PT - SAFE_MARGIN_PT * 2;

  for (const image of pageImages) {
    const imageBytes = this.dataUrlToUint8Array(image.dataUrl);
    const embedded = await pdfDoc.embedPng(imageBytes);

    const sourceWidth = image.width || embedded.width;
    const sourceHeight = image.height || embedded.height;

    const scale = Math.min(
      MAX_DRAW_WIDTH / sourceWidth,
      MAX_DRAW_HEIGHT / sourceHeight,
      1
    );

    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    const x = (A4_WIDTH_PT - drawWidth) / 2;
    const y = (A4_HEIGHT_PT - drawHeight) / 2;

    const page = pdfDoc.addPage([A4_WIDTH_PT, A4_HEIGHT_PT]);
    page.drawImage(embedded, {
      x,
      y,
      width: drawWidth,
      height: drawHeight,
    });
  }

  return await pdfDoc.save();
}


 // pdf oluÅŸturma son


 // pdf adÄ± oluÅŸturma
  private buildExportFileName(konu: string, altKonu: string): string {
    // Her kelimenin ilk harfini bÃ¼yÃ¼k yapar (TÃ¼rkÃ§e uyumlu)
    const capitalizeWords = (value: string): string =>
      value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .split(/\s+/)
        .map(
          (word) =>
            word.charAt(0).toLocaleUpperCase('tr-TR') +
            word.slice(1).toLocaleLowerCase('tr-TR')
        )
        .join(' ');

    // Tarih formatÄ±: 21.10.2025
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const tarih = `${day}.${month}.${year}`;

    // Grup adÄ±
    const grup = this.secilenGrup ? this.secilenGrup.trim() : '';

    // Alt konu
    const alt = altKonu ? capitalizeWords(altKonu) : '';

    // Dosya adÄ± biÃ§imi: GRUP - AltKonu - Tarih.pdf
    const fileNameParts = [];
    if (grup) fileNameParts.push(grup);
    if (alt) fileNameParts.push(alt);
    fileNameParts.push(tarih);

    return `${fileNameParts.join(' - ')}.pdf`;
  }



  
  private buildAnnotationPayload(): string {
    const annotations = Array.from(this.annotationStates.entries()).map(
      ([page, json]) => ({
        page,
        data: json,
      })
    );
    const backgrounds = Array.from(this.pageBackgrounds.entries()).map(
      ([page, mode]) => ({
        page,
        mode,
      })
    );
    const metrics = Array.from(this.pageMetrics.entries()).map(
      ([page, info]) => ({
        page,
        ...info,
      })
    );
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
    pdfCtx: CanvasRenderingContext2D
  ): void {
    const containerWidth =
      this.pdfContainer?.nativeElement.clientWidth ??
      pdfCanvasEl.parentElement?.clientWidth ??
      window.innerWidth ??
      900;
    const width = Math.max(720, Math.round(containerWidth));
    const height = Math.round(width * 1.414); // A4 oranâ”€â–’

    pdfCanvasEl.width = width;
    pdfCanvasEl.height = height;

    pdfCtx.fillStyle = '#ffffff';
    pdfCtx.fillRect(0, 0, width, height);

    const background =
      this.pageBackgrounds.get(pageNumber) ?? this.backgroundMode;
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
    this.setBaseDisplaySize(width, height);
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
        this.fabricCanvas!.getObjects()
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
          console.info(
            '[PDF::restoreAnnotations] No saved annotations for page',
            pageNumber
          );
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
      this.fabricCanvas!.getObjects()
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

  private async combineCurrentPageToDataUrl(
    pageNumber: number,
    totalPages: number
  ): Promise<{
    dataUrl: string;
    width: number;
    height: number;
  } | null> {
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
    const shouldRenderBranding = this.blankDocument;
    if (shouldRenderBranding) {
      await this.drawBrandingWatermark(ctx, out.width, out.height);
    }
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
    if (shouldRenderBranding) {
      this.drawBrandingOverlay(ctx, out.width, out.height, pageNumber, totalPages);
    }
    return {
      dataUrl: out.toDataURL('image/png'),
      width: out.width,
      height: out.height,
    };
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

  private async drawBrandingWatermark(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): Promise<void> {
    const logo = await this.loadBrandingLogo();
    if (!logo) {
      return;
    }

    const desiredSize = 500;
    const drawSize = Math.min(desiredSize, width, height);
    const logoX = (width - drawSize) / 2;
    const logoY = (height - drawSize) / 2;

    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.drawImage(logo, logoX, logoY, drawSize, drawSize);
    ctx.restore();
  }

  private getHeaderSubjectText(): string {
    const konu = (this.secilenKonu ?? '').trim();
    const alt = (this.secilenAltKonu ?? '').trim();
    const parts: string[] = [];
    if (konu) {
      parts.push(konu);
    }
    if (alt) {
      const konuLower = konu ? konu.toLocaleLowerCase('tr-TR') : '';
      const altLower = alt.toLocaleLowerCase('tr-TR');
      if (!konuLower || altLower !== konuLower) {
        parts.push(alt);
      }
    }
    const label = parts.join(' / ');
    if (label) {
      return label.toLocaleUpperCase('tr-TR');
    }
    return 'KONU BELIRTILMEDI';
  }

  private drawBrandingOverlay(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    pageNumber: number,
    totalPages: number
  ): void {
    const pxPerMm = height / 297;
    const horizontalMargin = Math.round(pxPerMm * 10);
    const headerTop = Math.round(pxPerMm * 15);
    const teacherFontSize = 30;
    const subjectFontSize = Math.max(18, Math.round(teacherFontSize * 0.65));
    const footerFontSize = Math.max(12, Math.round(pxPerMm * 4.2));
    const headerGap = Math.max(12, Math.round(pxPerMm * 2));
    const subjectText = this.getHeaderSubjectText();

    const subjectPaddingX = Math.max(16, Math.round(pxPerMm * 4));
    const subjectPaddingY = Math.max(10, Math.round(pxPerMm * 2.4));
    const teacherPaddingX = Math.max(20, Math.round(pxPerMm * 4.8));
    const teacherPaddingY = Math.max(12, Math.round(pxPerMm * 3));

    const drawCapsule = (
      x: number,
      y: number,
      w: number,
      h: number,
      fill: string,
      stroke: string,
      strokeWidth: number,
      shadow?: string
    ) => {
      const radius = Math.min(Math.max(16, h / 2), w / 2);
      ctx.save();
      if (shadow) {
        ctx.shadowColor = shadow;
        ctx.shadowBlur = Math.round(Math.max(12, h * 0.4));
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = Math.round(Math.max(6, h * 0.2));
      }
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.arcTo(x + w, y, x + w, y + h, radius);
      ctx.arcTo(x + w, y + h, x, y + h, radius);
      ctx.arcTo(x, y + h, x, y, radius);
      ctx.arcTo(x, y, x + w, y, radius);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (strokeWidth > 0) {
        ctx.lineWidth = strokeWidth;
        ctx.strokeStyle = stroke;
        ctx.stroke();
      }
      ctx.restore();
    };

    ctx.save();
    ctx.font = `600 ${subjectFontSize}px "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
    const subjectMetrics = ctx.measureText(subjectText);
    const subjectCapsuleWidth = subjectMetrics.width + subjectPaddingX * 2;
    const subjectCapsuleHeight = subjectFontSize + subjectPaddingY * 2;
    const subjectX = horizontalMargin;
    const subjectY = headerTop;
    drawCapsule(
      subjectX,
      subjectY,
      subjectCapsuleWidth,
      subjectCapsuleHeight,
      'rgba(15, 23, 42, 0.92)',
      'transparent',
      0,
      'rgba(15, 23, 42, 0.25)'
    );
    ctx.fillStyle = '#f8fafc';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(
      subjectText,
      subjectX + subjectPaddingX,
      subjectY + subjectCapsuleHeight / 2
    );

    ctx.font = `700 ${teacherFontSize}px "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
    const teacherMetrics = ctx.measureText(this.brandingHeaderText);
    const teacherCapsuleWidth = teacherMetrics.width + teacherPaddingX * 2;
    const teacherCapsuleHeight = teacherFontSize + teacherPaddingY * 2;
    const teacherX = width - horizontalMargin - teacherCapsuleWidth;
    const teacherY = headerTop;
    drawCapsule(
      teacherX,
      teacherY,
      teacherCapsuleWidth,
      teacherCapsuleHeight,
      'rgba(255, 102, 0, 0.12)',
      '#ff6600',
      Math.max(2, Math.round(pxPerMm * 0.6)),
      'rgba(255, 102, 0, 0.25)'
    );
    ctx.fillStyle = '#ff6600';
    ctx.textAlign = 'left';
    ctx.fillText(
      this.brandingHeaderText,
      teacherX + teacherPaddingX,
      teacherY + teacherCapsuleHeight / 2
    );
    ctx.restore();

    const headerLineY =
      Math.max(subjectY + subjectCapsuleHeight, teacherY + teacherCapsuleHeight) + headerGap;

    ctx.save();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(horizontalMargin, headerLineY);
    ctx.lineTo(width - horizontalMargin, headerLineY);
    ctx.stroke();
    ctx.restore();

    const pageLabel =
      totalPages && totalPages > 0
        ? `Sayfa ${pageNumber} / ${totalPages}`
        : `Sayfa ${pageNumber}`;

    ctx.save();
    ctx.font = `600 ${footerFontSize}px "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
    const pageTextMetrics = ctx.measureText(pageLabel);
    const pagePaddingX = Math.max(14, Math.round(pxPerMm * 3.5));
    const pagePaddingY = Math.max(8, Math.round(pxPerMm * 2));
    const pageCapsuleWidth = pageTextMetrics.width + pagePaddingX * 2;
    const pageCapsuleHeight = footerFontSize + pagePaddingY * 2;
    const pageCapsuleX = (width - pageCapsuleWidth) / 2;
    const targetCenterY = Math.round(pxPerMm * 287);
    const minPageY = headerLineY + headerGap;
    const maxPageY = height - pageCapsuleHeight - Math.round(pxPerMm * 5);
    let pageCapsuleY = Math.round(targetCenterY - pageCapsuleHeight / 2);
    pageCapsuleY = Math.max(minPageY, Math.min(maxPageY, pageCapsuleY));

    drawCapsule(
      pageCapsuleX,
      pageCapsuleY,
      pageCapsuleWidth,
      pageCapsuleHeight,
      'rgba(255, 102, 0, 0.12)',
      '#ff6600',
      Math.max(2, Math.round(pxPerMm * 0.6))
    );

    ctx.fillStyle = '#ff6600';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pageLabel, width / 2, pageCapsuleY + pageCapsuleHeight / 2);
    ctx.restore();
  }

  private async loadBrandingLogo(): Promise<HTMLImageElement | null> {
    if (this.brandingLogoImage) {
      return this.brandingLogoImage;
    }

    if (this.brandingLogoImage === null) {
      return null;
    }

    if (!this.brandingLogoPromise) {
      this.brandingLogoPromise = new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          this.brandingLogoImage = img;
          resolve(img);
        };
        img.onerror = () => {
          console.error('[PDF::loadBrandingLogo] Logo could not be loaded');
          this.brandingLogoImage = null;
          resolve(null);
        };
        img.src = this.brandingLogoSrc;
      });
    }

    await this.brandingLogoPromise;
    return this.brandingLogoImage ?? null;
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

    this.clipboardBasePosition = {
      left: active.left ?? 0,
      top: active.top ?? 0,
    };
    this.resetClipboardOffset();

    const offset = this.getNextClipboardOffset();
    const targetLeft = this.clipboardBasePosition.left + offset.x;
    const targetTop = this.clipboardBasePosition.top + offset.y;

    const clone = await active.clone();
    clone.set({
      left: targetLeft,
      top: targetTop,
      evented: true,
      selectable: true,
    });
    clone.setCoords();
    canvas.add(clone);
    this.ensureObjectWithinCanvas(clone);
    canvas.setActiveObject(clone);
    canvas.requestRenderAll();
    this.updateSelectionState(true, clone);
    this.markUnsavedChange();

    this.clipboardBasePosition = {
      left: clone.left ?? targetLeft,
      top: clone.top ?? targetTop,
    };
    this.clipboardObject = await clone.clone();
    this.clipboardObject.set({
      left: this.clipboardBasePosition.left,
      top: this.clipboardBasePosition.top,
      evented: true,
      selectable: true,
    });
    this.resetClipboardOffset();

    this.alertService.success('Kopya olusturuldu.', 'Kopyalandi');
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
      evented: true,
      selectable: true,
    });
    this.clipboardBasePosition = {
      left: active.left ?? 0,
      top: active.top ?? 0,
    };
    this.resetClipboardOffset();
    this.selectionMenu.visible = false;
    this.hasSelection = false;
    canvas.remove(active);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    this.updateSelectionState(false);
    this.markUnsavedChange();
    this.alertService.info(
      'Secim panoya kesildi. Yapistir secenegini kullanin.',
      'Kesildi'
    );
  }

  async pasteSelection(): Promise<void> {
    const canvas = this.fabricCanvas;
    if (!canvas || !this.clipboardObject) {
      this.alertService.warning(
        'Panoda yapistirilacak oge bulunamadi.',
        'Panoya Erisim'
      );
      return;
    }

    if (!this.clipboardBasePosition) {
      this.clipboardBasePosition = {
        left: this.clipboardObject.left ?? 0,
        top: this.clipboardObject.top ?? 0,
      };
      this.resetClipboardOffset();
    }

    const offset = this.getNextClipboardOffset();
    const base = this.clipboardBasePosition;
    const targetLeft = base.left + offset.x;
    const targetTop = base.top + offset.y;

    const clone = await this.clipboardObject.clone();
    clone.set({
      left: targetLeft,
      top: targetTop,
      evented: true,
      selectable: true,
    });
    clone.setCoords();
    canvas.add(clone);
    this.ensureObjectWithinCanvas(clone);
    canvas.setActiveObject(clone);
    canvas.requestRenderAll();
    this.updateSelectionState(true, clone);
    this.markUnsavedChange();

    this.clipboardBasePosition = {
      left: clone.left ?? targetLeft,
      top: clone.top ?? targetTop,
    };
    this.clipboardObject = await clone.clone();
    this.clipboardObject.set({
      left: this.clipboardBasePosition.left,
      top: this.clipboardBasePosition.top,
      evented: true,
      selectable: true,
    });
    this.resetClipboardOffset();

    this.alertService.success('Yapistirma tamamlandi.', 'Yapistirildi');
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
    this.alertService.info('SeÃ§ili Ã¶ÄŸe silindi.', 'Silindi');
  }

  startCrop(): void {
    if (this.isCropping) {
      return;
    }
    const canvas = this.fabricCanvas;
    const active = canvas?.getActiveObject();
    if (!canvas || !active || !(active instanceof fabric.Image)) {
      this.alertService.warning(
        'KÄ±rpma iÃ§in bir gÃ¶rsel seÃ§in.',
        'GÃ¶rsel SeÃ§ilmedi'
      );
      return;
    }
    if (Math.abs(active.angle ?? 0) > 0.001) {
      this.alertService.warning(
        'DÃ¶ndÃ¼rÃ¼lmÃ¼ÅŸ gÃ¶rsellerde kÄ±rpma desteklenmiyor.',
        'KÄ±rpma Desteklenmiyor'
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
    if (
      !this.isCropping ||
      !this.cropRect ||
      !this.cropTarget ||
      !this.fabricCanvas
    ) {
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
    let sourceX =
      (rectBounds.left - targetBounds.left) / scaleX + (target.cropX ?? 0);
    let sourceY =
      (rectBounds.top - targetBounds.top) / scaleY + (target.cropY ?? 0);
    let sourceWidth = rectBounds.width / scaleX;
    let sourceHeight = rectBounds.height / scaleY;

    sourceX = Math.max(0, sourceX);
    sourceY = Math.max(0, sourceY);
    sourceWidth = Math.max(
      1,
      Math.min(sourceWidth, (target.width ?? 0) - sourceX)
    );
    sourceHeight = Math.max(
      1,
      Math.min(sourceHeight, (target.height ?? 0) - sourceY)
    );

    const element = target.getElement();
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = Math.round(sourceWidth);
    tempCanvas.height = Math.round(sourceHeight);
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) {
      this.alertService.error('KÄ±rpma iÅŸlemi baÅŸlatÄ±lamadÄ±.', 'KÄ±rpma HatasÄ±');
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
      tempCanvas.height
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
    const insertIndex =
      insertionIndex >= 0 ? insertionIndex : canvas.getObjects().length;
    canvas.insertAt(insertIndex, cropped);
    canvas.setActiveObject(cropped);
    canvas.requestRenderAll();
    this.updateSelectionState(true, cropped);
    this.markUnsavedChange();
    this.alertService.success('GÃ¶rsel kÄ±rpÄ±ldÄ±.', 'KÄ±rpma Tamam');
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
        'LÃ¼tfen geÃ§erli bir gÃ¶rsel dosyasÄ± seÃ§in.',
        'GeÃ§ersiz Dosya'
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
      this.alertService.warning('Ã‡izim alanÄ± hazÄ±r deÄŸil.', 'Åekil Eklenemedi');
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
          const radius = Math.max(
            60,
            Math.min(canvasWidth, canvasHeight) * 0.18
          );
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
      this.alertService.warning('Ã‡izim alanÄ± hazÄ±r deÄŸil.', 'Åekil Eklenemedi');
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
      const img = await fabric.Image.fromURL(dataUrl, {
        crossOrigin: 'anonymous',
      });
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
      this.alertService.success('GÃ¶rsel tahtaya eklendi.', 'GÃ¶rsel HazÄ±r');
    } catch (error) {
      console.error('[PDF::addImageToCanvas] Gâ”œÃ‚rsel eklenemedi', error);
      this.alertService.error(
        'GÃ¶rsel yÃ¼klenirken bir hata oluÅŸtu.',
        'GÃ¶rsel HatasÄ±'
      );
    } finally {
      this.allowSelectableForNextObject = false;
    }
  }

  private updateSelectionState(
    state: boolean,
    target?: fabric.Object | null
  ): void {
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
    const containerRect =
      this.pdfContainer?.nativeElement.getBoundingClientRect();
    const annotationRect =
      this.annotationCanvas?.nativeElement.getBoundingClientRect();
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
    const containerRect =
      this.pdfContainer?.nativeElement.getBoundingClientRect();
    const annotationRect =
      this.annotationCanvas?.nativeElement.getBoundingClientRect();
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















