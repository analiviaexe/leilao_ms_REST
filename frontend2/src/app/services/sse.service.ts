import { Injectable, NgZone } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { Notificacao } from '../models/models';

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

    this.eventSource = new EventSource(`${this.SSE_URL}/${usuarioId}`);

    this.eventSource.addEventListener('connected', (event: any) => {
      this.ngZone.run(() => {
        this.conectadoSubject.next(true);
        this.notificacoesSubject.next({
          tipo: 'sistema',
          mensagem: 'Conectado ao servidor de notificações',
          timestamp: new Date().toISOString()
        });
      });
    });

    this.eventSource.addEventListener('interesse_registrado', (event: any) => {
      this.ngZone.run(() => {
        const dados = JSON.parse(event.data);
        this.notificacoesSubject.next({
          tipo: 'interesse',
          mensagem: `Acompanhando leilão ${dados.leilaoNome || dados.leilaoId}`,
          ...dados
        });
      });
    });

    this.eventSource.addEventListener('novo_lance', (event: any) => {
      this.ngZone.run(() => {
        const dados = JSON.parse(event.data);
        this.notificacoesSubject.next({
          tipo: 'novo_lance',
          mensagem: `Novo lance de R$ ${dados.valor} no leilão "${dados.leilaoNome || dados.leilaoId}"`,
          ...dados
        });
      });
    });

    this.eventSource.addEventListener('lance_invalido', (event: any) => {
      this.ngZone.run(() => {
        const dados = JSON.parse(event.data);
        this.notificacoesSubject.next({
          tipo: 'lance_invalido',
          mensagem: `Lance rejeitado: ${dados.motivo}`,
          ...dados
        });
        alert(`Seu lance foi rejeitado: ${dados.motivo}`);
      });
    });

    this.eventSource.addEventListener('leilao_vencedor', (event: any) => {
      this.ngZone.run(() => {
        const dados = JSON.parse(event.data);
        this.notificacoesSubject.next({
          tipo: 'leilao_vencedor',
          mensagem: `Leilão "${dados.leilaoNome || dados.leilaoId}" finalizado! Vencedor: usuário ${dados.vencedorId} por R$ ${dados.valorFinal}`,
          ...dados
        });
      });
    });

    this.eventSource.addEventListener('link_pagamento', (event: any) => {
      this.ngZone.run(() => {
        const dados = JSON.parse(event.data);
        this.notificacoesSubject.next({
          tipo: 'link_pagamento',
          mensagem: `Link de pagamento: ${dados.link}`,
          ...dados
        });
      });
    });

    this.eventSource.addEventListener('status_pagamento', (event: any) => {
      this.ngZone.run(() => {
        const dados = JSON.parse(event.data);
        const statusMsg = dados.status === 'aprovado' 
          ? `Pagamento aprovado!`
          : `Pagamento recusado: ${dados.motivo || 'Erro no processamento'}`;
        
        this.notificacoesSubject.next({
          tipo: 'status_pagamento',
          mensagem: statusMsg,
          ...dados
        });
      });
    });

    this.eventSource.onerror = (error) => {
      this.ngZone.run(() => {
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
