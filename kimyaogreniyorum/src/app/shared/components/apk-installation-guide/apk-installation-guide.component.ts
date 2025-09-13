import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { trigger, state, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'app-apk-installation-guide',
  templateUrl: './apk-installation-guide.component.html',
  styleUrls: ['./apk-installation-guide.component.scss'],
  standalone: false,
  animations: [
    trigger('modalAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.8)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'scale(1)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'scale(0.8)' }))
      ])
    ])
  ]
})
export class ApkInstallationGuideComponent implements OnInit {
  @Output() closeModal = new EventEmitter<void>();

  showModal = false;
  currentStep = 1;
  totalSteps = 5;

  steps = [
    {
      title: 'APK Dosyasını İndirin',
      description: 'Mobil alert\'ten veya bu sayfadan APK dosyasını telefonunuza indirin.',
      icon: 'fas fa-download',
      details: [
        'Telefonunuzdan bu sayfayı açın',
        '"APK İndir" butonuna tıklayın',
        'İndirme işleminin tamamlanmasını bekleyin'
      ]
    },
    {
      title: 'Bilinmeyen Kaynaklar İzni',
      description: 'Android güvenlik ayarlarından "Bilinmeyen kaynaklar"ı etkinleştirin.',
      icon: 'fas fa-shield-alt',
      details: [
        'Telefon Ayarları → Güvenlik',
        '"Bilinmeyen kaynaklar" seçeneğini bulun',
        'Bu özelliği etkinleştirin (açın)'
      ]
    },
    {
      title: 'APK Dosyasını Bulun',
      description: 'İndirilen APK dosyasını telefon dosya yöneticisinde bulun.',
      icon: 'fas fa-folder-open',
      details: [
        'Dosya Yöneticisi uygulamasını açın',
        '"İndirilenler" klasörüne gidin',
        '"kimya-ogreniyorum.apk" dosyasını bulun'
      ]
    },
    {
      title: 'Kurulumu Başlatın',
      description: 'APK dosyasına tıklayarak kurulum işlemini başlatın.',
      icon: 'fas fa-play-circle',
      details: [
        'APK dosyasına tıklayın',
        '"Kur" veya "Install" butonuna basın',
        'Gerekli izinleri onaylayın'
      ]
    },
    {
      title: 'Uygulamayı Başlatın',
      description: 'Kurulum tamamlandıktan sonra uygulamayı açabilirsiniz.',
      icon: 'fas fa-rocket',
      details: [
        'Ana ekranda "Kimya Öğreniyorum" iconunu bulun',
        'Uygulamaya tıklayarak açın',
        'Giriş bilgilerinizle oturum açın'
      ]
    }
  ];

  constructor() { }

  ngOnInit(): void {
    // Modal'ı göster
    setTimeout(() => {
      this.showModal = true;
    }, 100);
  }

  nextStep(): void {
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
    }
  }

  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  goToStep(step: number): void {
    this.currentStep = step;
  }

  close(): void {
    this.showModal = false;
    setTimeout(() => {
      this.closeModal.emit();
    }, 200);
  }

  downloadAPK(): void {
    // APK indirme işlemi
    const link = document.createElement('a');
    link.href = '/public/downloads/kimya-ogreniyorum.apk';
    link.download = 'kimya-ogreniyorum.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  getCurrentStep() {
    return this.steps[this.currentStep - 1];
  }
}