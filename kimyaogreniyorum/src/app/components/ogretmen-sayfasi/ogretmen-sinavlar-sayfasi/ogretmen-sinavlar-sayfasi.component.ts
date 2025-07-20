import { HttpClient } from '@angular/common/http';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CevapAnahtari } from '../modeller/cevap-anahtari';


@Component({
  selector: 'app-ogretmen-sinavlar-sayfasi',
  standalone: false,
  templateUrl: './ogretmen-sinavlar-sayfasi.component.html',
  styleUrl: './ogretmen-sinavlar-sayfasi.component.scss',
})
export class OgretmenSinavlarSayfasiComponent implements OnInit {
  activeTab: string = 'cevap-anahtari';

  constructor() {}

  ngOnInit(): void {}

  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }
}