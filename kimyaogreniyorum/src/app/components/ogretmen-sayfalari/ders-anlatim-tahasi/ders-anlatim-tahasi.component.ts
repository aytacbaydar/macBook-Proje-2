import { Component, OnInit, AfterViewInit, OnDestroy, HostListener } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { jsPDF } from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist';
import * as fabric from 'fabric';
import { SocketService } from '../../../services/socket.service';

@Component({
  selector: 'app-ogretmen-ders-anlatma-tahtasi',
  templateUrl: './ders-anlatim-tahasi.component.html',
  styleUrls: ['./ders-anlatim-tahasi.component.scss'],
  standalone: false,
})
export class DersAnlatimTahasiComponent implements OnInit, AfterViewInit, OnDestroy {
  canvasInstances: fabric.Canvas[] = [];
  pagesJson: any[] = [];
  currentPage: number = 1;
  totalPages: number = 1;

  kalemRengi = '#000000';
  kalemKalinligi = 4;
  cizilebilir = true;
  silgiModu = false;
  fosforluKalemModu = false;
  secilenFosforluRenk = '#ffff0080';
  currentBackground: 'bos' | 'cizgili' | 'kareli' = 'bos';

  pdfYukleniyor = false;
  kaydetmeIsleminde = false;

  dersId = 'kimya-11a';
  userRole: 'ogretmen' | 'ogrenci' = 'ogretmen';

  constructor(private http: HttpClient, private socket: SocketService) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  ngOnInit(): void {
    this.socket.connect(this.userRole, this.dersId);
    this.socket.listen<string>('canvas:update').subscribe((json) => {
      // öğrenciler güncelleme alır
      if (this.userRole === 'ogrenci') {
        const canvas = this.canvasInstances[this.currentPage - 1];
        if (canvas) {
          canvas.loadFromJSON(json, () => canvas.renderAll());
        }
      }
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.ensureCanvas(this.currentPage), 300);
  }

  private ensureCanvas(pageNo: number) {
    if (this.canvasInstances[pageNo - 1]) return;
    const canvasEl = document.getElementById(`canvas-${pageNo}`) as HTMLCanvasElement;
    const width = Math.min(window.innerWidth - 40, 1200);
    const height = Math.round(width * 1.414);
    const canvas = new fabric.Canvas(canvasEl, {
      isDrawingMode: true,
      backgroundColor: '#ffffff',
      width,
      height,
    });
    this.canvasInstances[pageNo - 1] = canvas;
    this.applyBrush();
    this.setBackground(this.currentBackground);
    canvas.on('path:created', () => this.emitCanvasUpdate());
  }

  private applyBrush() {
    const c = this.canvasInstances[this.currentPage - 1];
    if (!c) return;
    if (this.silgiModu) {
      try {
        const Eraser = (fabric as any).EraserBrush;
        c.freeDrawingBrush = new Eraser(c);
      } catch {
        const brush = new (fabric as any).PencilBrush(c);
        // @ts-ignore
        brush.globalCompositeOperation = 'destination-out';
        c.freeDrawingBrush = brush;
      }
      c.freeDrawingBrush.width = this.kalemKalinligi * 2;
    } else if (this.fosforluKalemModu) {
      const brush = new (fabric as any).PencilBrush(c);
      brush.color = this.secilenFosforluRenk;
      brush.width = this.kalemKalinligi * 3;
      c.freeDrawingBrush = brush;
    } else {
      const brush = new (fabric as any).PencilBrush(c);
      brush.color = this.kalemRengi;
      brush.width = this.kalemKalinligi;
      c.freeDrawingBrush = brush;
    }
  }

  private emitCanvasUpdate() {
    if (this.userRole === 'ogretmen') {
      const c = this.canvasInstances[this.currentPage - 1];
      if (c) this.socket.emit('canvas:update', JSON.stringify(c));
    }
  }

  // === ZEMİN (defter görünümü) ===
  setBackground(type: 'bos' | 'cizgili' | 'kareli') {
    const c = this.canvasInstances[this.currentPage - 1];
    if (!c) return;
    const patternCanvas = document.createElement('canvas');
    const pctx = patternCanvas.getContext('2d')!;
    const size = 30;
    if (type === 'cizgili') {
      patternCanvas.width = c.getWidth();
      patternCanvas.height = size;
      pctx.strokeStyle = '#d0d0d0';
      pctx.beginPath();
      pctx.moveTo(0, size - 1);
      pctx.lineTo(patternCanvas.width, size - 1);
      pctx.stroke();
    } else if (type === 'kareli') {
      patternCanvas.width = size;
      patternCanvas.height = size;
      pctx.strokeStyle = '#d0d0d0';
      pctx.strokeRect(0, 0, size, size);
    } else {
      c.setBackgroundColor('#fff', c.renderAll.bind(c));
      return;
    }
    const pattern = new fabric.Pattern({ source: patternCanvas, repeat: 'repeat' });
    c.setBackgroundColor(pattern, c.renderAll.bind(c));
  }

  async pdfYukle(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.pdfYukleniyor = true;
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const canvas = this.canvasInstances[this.currentPage - 1];
      const viewport = page.getViewport({ scale: 1.5 });
      const tmp = document.createElement('canvas');
      tmp.width = viewport.width;
      tmp.height = viewport.height;
      const ctx = tmp.getContext('2d')!;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const img = tmp.toDataURL('image/png');
      canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
        scaleX: canvas.width! / viewport.width,
        scaleY: canvas.height! / viewport.height,
      });
      this.emitCanvasUpdate();
    }
    this.pdfYukleniyor = false;
  }

  downloadPNG() {
    const c = this.canvasInstances[this.currentPage - 1];
    const data = c.toDataURL({ format: 'png', multiplier: 2 });
    const link = document.createElement('a');
    link.href = data;
    link.download = `tahta-${this.currentPage}.png`;
    link.click();
  }

  indirPDF() {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const c = this.canvasInstances[this.currentPage - 1];
    const data = c.toDataURL('image/jpeg', 0.8);
    pdf.addImage(data, 'JPEG', 10, 10, 190, 270);
    pdf.save('tahta.pdf');
  }

  ngOnDestroy(): void {
    this.socket.disconnect();
  }

  @HostListener('window:resize')
  resize() {
    this.canvasInstances.forEach((c) => c?.renderAll());
  }
}
