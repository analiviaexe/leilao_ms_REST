import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

import { LoginComponent } from './components/login/login.component';
import { ListaLeiloesComponent } from './components/lista-leiloes/lista-leiloes.component';
import { FormularioLanceComponent } from './components/formulario-lance/formulario-lance.component';
import { CriarLeilaoComponent } from './components/criar-leilao/criar-leilao.component';
import { NotificacoesComponent } from './components/notificacoes/notificacoes.component';

import { ApiService } from './services/api.service';
import { SseService } from './services/sse.service';
import { Leilao, Notificacao } from './models/models';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    LoginComponent,
    ListaLeiloesComponent,
    FormularioLanceComponent,
    CriarLeilaoComponent,
    NotificacoesComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnDestroy {
  usuarioId: string = '';
  logado: boolean = false;
  leiloes: Leilao[] = [];
  notificacoes: Notificacao[] = [];
  sseConectado: boolean = false;
  interessesCount: number = 0;

  private notificacoesSubscription?: Subscription;
  private conexaoSubscription?: Subscription;

  constructor(
    private apiService: ApiService,
    private sseService: SseService
  ) {}

  ngOnDestroy(): void {
    this.sseService.desconectar();
    this.notificacoesSubscription?.unsubscribe();
    this.conexaoSubscription?.unsubscribe();
  }

  onUsuarioLogado(usuarioId: string): void {
    this.usuarioId = usuarioId;
    this.logado = true;
    this.carregarLeiloes();
  }

  onInteresseRegistrado(deveConectarSSE: boolean): void {
    this.interessesCount++;
    
    if (deveConectarSSE && !this.sseConectado) {
      this.conectarSSE();
    }
  }

  onInteresseCancelado(sseDesconectado: boolean): void {
    this.interessesCount--;
    
    if (sseDesconectado) {
      this.sseConectado = false;
      this.interessesCount = 0;
      this.notificacoesSubscription?.unsubscribe();
      this.conexaoSubscription?.unsubscribe();
    }
  }

  conectarSSE(): void {
    if (this.sseConectado) return;
    
    this.sseService.conectar(this.usuarioId);
    
    this.notificacoesSubscription = this.sseService.obterNotificacoes().subscribe(
      (notificacao) => {
        this.notificacoes = [notificacao, ...this.notificacoes];
      }
    );

    this.conexaoSubscription = this.sseService.obterStatusConexao().subscribe(
      (conectado) => {
        this.sseConectado = conectado;
      }
    );
  }

  desconectarSSE(): void {
    this.sseService.desconectar();
    this.notificacoesSubscription?.unsubscribe();
    this.conexaoSubscription?.unsubscribe();
    this.sseConectado = false;
  }

  carregarLeiloes(): void {
    this.apiService.listarLeiloesAtivos().subscribe({
      next: (leiloes) => {
        this.leiloes = leiloes;
      },
      error: (err) => {
        alert('Erro ao carregar leilões');
      }
    });
  }

  onLeilaoCriado(): void {
    this.carregarLeiloes();
  }
}
