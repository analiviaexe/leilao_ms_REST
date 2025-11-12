import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

import { LoginComponent } from './components/login/login.component';
import { ListaLeiloesComponent } from './components/lista-leiloes/lista-leiloes.component';
import { FormularioLanceComponent } from './components/formulario-lance/formulario-lance.component';
import { CriarLeilaoComponent } from './components/criar-leilao/criar-leilao.component';
import { NotificacoesComponent } from './components/notificacoes/notificacoes.component';

import { ApiService } from './services/api.service';
import { SseService } from './services/sse.service';
import { Leilao } from './models/leilao.model';
import { Notificacao } from './models/notificacao.model';
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
export class AppComponent implements OnInit, OnDestroy {
  usuarioId: string = '';
  logado: boolean = false;
  leiloes: Leilao[] = [];
  notificacoes: Notificacao[] = [];
  sseConectado: boolean = false;

  private notificacoesSubscription?: Subscription;
  private conexaoSubscription?: Subscription;

  constructor(
    private apiService: ApiService,
    private sseService: SseService
  ) {}

  ngOnInit(): void {
    // Inicialização
  }

  ngOnDestroy(): void {
    this.sseService.desconectar();
    this.notificacoesSubscription?.unsubscribe();
    this.conexaoSubscription?.unsubscribe();
  }

  onUsuarioLogado(usuarioId: string): void {
    this.usuarioId = usuarioId;
    this.logado = true;
    
    // NÃO conectar SSE automaticamente - usuário deve escolher explicitamente
    
    // Carregar leilões
    this.carregarLeiloes();
  }

  conectarSSE(): void {
    if (this.sseConectado) return;
    
    this.sseService.conectar(this.usuarioId);
    
    // Inscrever-se nas notificações
    this.notificacoesSubscription = this.sseService.obterNotificacoes().subscribe(
      (notificacao) => {
        this.notificacoes = [notificacao, ...this.notificacoes];
      }
    );

    // Inscrever-se no status da conexão
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
        console.log('Leilões recebidos da API:', leiloes);
        this.leiloes = leiloes;
      },
      error: (err) => {
        console.error('Erro ao carregar leilões:', err);
        alert('Erro ao carregar leilões');
      }
    });
  }

  onLeilaoCriado(): void {
    this.carregarLeiloes();
  }
}
