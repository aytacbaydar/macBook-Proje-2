
import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';

@Component({
  selector: 'app-ogrenci-odevler-sayfasi',
  standalone: false,
  templateUrl: './ogrenci-odevler-sayfasi.component.html',
  styleUrl: './ogrenci-odevler-sayfasi.component.scss'
})
export class OgrenciOdevlerSayfasiComponent implements OnInit {
  odevler: any[] = [];
  isLoading: boolean = false;
  currentUser: any = null;

  constructor(
    private http: HttpClient,
    private toastr: ToastrService,
    private router: Router
  ) {}

  ngOnInit(): void {

  }

}
