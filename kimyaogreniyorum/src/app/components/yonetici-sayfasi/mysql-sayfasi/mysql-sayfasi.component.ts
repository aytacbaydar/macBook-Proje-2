
import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-mysql-sayfasi',
  templateUrl: './mysql-sayfasi.component.html',
  styleUrls: ['./mysql-sayfasi.component.scss'],
  standalone: false
})
export class MysqlSayfasiComponent implements OnInit {
  tableName: string = '';
  columns: Array<{name: string, type: string, length: string, notNull: boolean, primaryKey: boolean, autoIncrement: boolean}> = [];
  availableTypes: string[] = [
    'INT', 'VARCHAR', 'TEXT', 'DATE', 'DATETIME', 'FLOAT', 'DOUBLE', 
    'BOOLEAN', 'ENUM', 'JSON', 'BLOB', 'LONGTEXT', 'DECIMAL', 'TIMESTAMP'
  ];
  sqlPreview: string = '';
  createTableForm: FormGroup;
  isLoading: boolean = false;
  isSuccess: boolean = false;
  errorMessage: string = '';
  
  constructor(private http: HttpClient, private fb: FormBuilder) {
    this.createTableForm = this.fb.group({
      tableName: ['', [Validators.required, Validators.pattern('^[a-zA-Z][a-zA-Z0-9_]*$')]],
      databaseName: ['kimyaogreniyorum', Validators.required]
    });
  }

  ngOnInit(): void {
    this.addColumn();
    this.updateSqlPreview();
  }

  addColumn(): void {
    this.columns.push({
      name: '',
      type: 'VARCHAR',
      length: '255',
      notNull: false,
      primaryKey: false,
      autoIncrement: false
    });
    this.updateSqlPreview();
  }

  removeColumn(index: number): void {
    this.columns.splice(index, 1);
    this.updateSqlPreview();
  }

  updateSqlPreview(): void {
    if (!this.createTableForm.value.tableName) {
      this.sqlPreview = '';
      return;
    }

    let sql = `CREATE TABLE ${this.createTableForm.value.tableName} (\n`;
    
    const validColumns = this.columns.filter(column => column.name.trim() !== '');
    
    if (validColumns.length === 0) {
      this.sqlPreview = '';
      return;
    }
    
    const columnDefinitions = validColumns.map(column => {
      let def = `  ${column.name} ${column.type}`;
      
      if (['VARCHAR', 'CHAR', 'DECIMAL', 'INT'].includes(column.type) && column.length) {
        def += `(${column.length})`;
      }
      
      if (column.notNull) {
        def += ' NOT NULL';
      }
      
      if (column.primaryKey) {
        def += ' PRIMARY KEY';
      }
      
      if (column.autoIncrement) {
        def += ' AUTO_INCREMENT';
      }
      
      return def;
    });
    
    sql += columnDefinitions.join(',\n');
    sql += '\n);';
    
    this.sqlPreview = sql;
  }

  createTable(): void {
    if (this.createTableForm.invalid) {
      this.errorMessage = 'Lütfen tablo adını doğru formatta girin (harf ile başlamalı, sadece harf, rakam ve alt çizgi içerebilir).';
      return;
    }

    const validColumns = this.columns.filter(column => column.name.trim() !== '');
    if (validColumns.length === 0) {
      this.errorMessage = 'En az bir kolon eklemelisiniz.';
      return;
    }

    this.isLoading = true;
    this.isSuccess = false;
    this.errorMessage = '';

    // Tabloyu oluşturmak için API isteği gönder
    this.http.post('./server/api/create_table.php', {
      tableName: this.createTableForm.value.tableName,
      databaseName: this.createTableForm.value.databaseName,
      columns: validColumns
    }).subscribe({
      next: (response: any) => {
        this.isLoading = false;
        if (response.success) {
          this.isSuccess = true;
          // Başarılı olduğunda formu sıfırla
          this.columns = [{
            name: '',
            type: 'VARCHAR',
            length: '255',
            notNull: false,
            primaryKey: false,
            autoIncrement: false
          }];
          this.createTableForm.get('tableName')?.setValue('');
          this.updateSqlPreview();
        } else {
          this.errorMessage = response.message || 'Tablo oluşturulurken bir hata oluştu.';
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = 'Sunucu hatası: ' + (error.message || 'Bilinmeyen bir hata oluştu.');
        console.error('API hatası:', error);
      }
    });
  }

  resetForm(): void {
    this.createTableForm.reset({
      tableName: '',
      databaseName: 'kimyaogreniyorum'
    });
    this.columns = [{
      name: '',
      type: 'VARCHAR',
      length: '255',
      notNull: false,
      primaryKey: false,
      autoIncrement: false
    }];
    this.updateSqlPreview();
    this.isSuccess = false;
    this.errorMessage = '';
  }

  formatSql(): string {
    return this.sqlPreview.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;');
  }
}
