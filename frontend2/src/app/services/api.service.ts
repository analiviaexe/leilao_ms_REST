import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Leilao, Lance } from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly API_URL = 'http://localhost:3000';

  constructor(private http: HttpClient) { }

  criarLeilao(leilao: any): Observable<Leilao> {
    return this.http.post<Leilao>(`${this.API_URL}/leiloes`, leilao);
  }

  listarLeiloesAtivos(): Observable<Leilao[]> {
    return this.http.get<Leilao[]>(`${this.API_URL}/leiloes/ativos`);
  }

  enviarLance(lance: Lance): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/lances`, lance);
  }

  registrarInteresse(usuarioId: string, leilaoId: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/leiloes/interesse/${usuarioId}/${leilaoId}`, {});
  }

  cancelarInteresse(usuarioId: string, leilaoId: string): Observable<any> {
    return this.http.delete<any>(`${this.API_URL}/leiloes/interesse/${usuarioId}/${leilaoId}`);
  }
}
