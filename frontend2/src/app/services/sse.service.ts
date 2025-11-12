import { Injectable, NgZone } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { Notificacao } from '../models/notificacao.model';

@Injectable({
  providedIn: 'root'
})
export class SseService {
  private readonly SSE_URL = 'http://localhost:3000/sse';
  private eventSource: EventSource | null = null;
  private notificacoesSubject = new Subject<Notificacao>();
  private conectadoSubject = new Subject<boolean>();

  constructor(private ngZone: NgZone) { }

  conectar(usuarioId: string): void {
    if (this.eventSource) {
      this.eventSource.close();
    }

    console.log(`[SSE] Conectando usuário ${usuarioId}`);
    this.eventSource = new EventSource(`${this.SSE_URL}/${usuarioId}`);

    // Evento: connected
    this.eventSource.addEventListener('connected', (event: any) => {
      this.ngZone.run(() => {
        console.log('[SSE] Conectado:', event.data);
        this.conectadoSubject.next(true);
        this.notificacoesSubject.next({
          tipo: 'sistema',
          mensagem: 'Conectado ao servidor de notificações',
          timestamp: new Date().toISOString()
        });
      });
    });

    // Evento: interesse_registrado
    this.eventSource.addEventListener('interesse_registrado', (event: any) => {
      this.ngZone.run(() => {
        const dados = JSON.parse(event.data);
        console.log('[SSE] Interesse registrado:', dados);
        this.notificacoesSubject.next({
          tipo: 'interesse',
          mensagem: `Acompanhando leilão ${dados.leilaoId}`,
          ...dados
        });
      });
    });

    // Evento: novo_lance
    this.eventSource.addEventListener('novo_lance', (event: any) => {
      this.ngZone.run(() => {
        const dados = JSON.parse(event.data);
        console.log('[SSE] Novo lance:', dados);
        this.notificacoesSubject.next({
          tipo: 'novo_lance',
          mensagem: `Novo lance de R$ ${dados.valor} no leilão ${dados.leilaoId}`,
          ...dados
        });
      });
    });

    // Evento: lance_invalido
    this.eventSource.addEventListener('lance_invalido', (event: any) => {
      this.ngZone.run(() => {
        const dados = JSON.parse(event.data);
        console.log('[SSE] Lance inválido:', dados);
        this.notificacoesSubject.next({
          tipo: 'lance_invalido',
          mensagem: `Lance rejeitado: ${dados.motivo}`,
          ...dados
        });
        alert(`Seu lance foi rejeitado: ${dados.motivo}`);
      });
    });

    // Evento: leilao_vencedor
    this.eventSource.addEventListener('leilao_vencedor', (event: any) => {
      this.ngZone.run(() => {
        const dados = JSON.parse(event.data);
        console.log('[SSE] Leilão vencedor:', dados);
        this.notificacoesSubject.next({
          tipo: 'leilao_vencedor',
          mensagem: `Leilão ${dados.nome} finalizado! Vencedor: usuário ${dados.vencedorId} por R$ ${dados.valorFinal}`,
          ...dados
        });
      });
    });

    // Erro
    this.eventSource.onerror = (error) => {
      this.ngZone.run(() => {
        console.error('[SSE] Erro:', error);
        this.conectadoSubject.next(false);
        this.notificacoesSubject.next({
          tipo: 'erro',
          mensagem: 'Erro na conexão com servidor',
          timestamp: new Date().toISOString()
        });
      });
    };
  }

  desconectar(): void {
    if (this.eventSource) {
      console.log('[SSE] Desconectando');
      this.eventSource.close();
      this.eventSource = null;
      this.conectadoSubject.next(false);
    }
  }

  obterNotificacoes(): Observable<Notificacao> {
    return this.notificacoesSubject.asObservable();
  }

  obterStatusConexao(): Observable<boolean> {
    return this.conectadoSubject.asObservable();
  }
}
