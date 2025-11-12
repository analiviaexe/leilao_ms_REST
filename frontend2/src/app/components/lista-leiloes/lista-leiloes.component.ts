import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Leilao } from '../../models/leilao.model';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-lista-leiloes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lista-leiloes.component.html',
  styleUrl: './lista-leiloes.component.css'
})
export class ListaLeiloesComponent implements OnChanges {
  @Input() leiloes: Leilao[] = [];
  @Input() usuarioId: string = '';
  @Output() interesseRegistrado = new EventEmitter<boolean>();
  @Output() interesseCancelado = new EventEmitter<boolean>();

  constructor(private apiService: ApiService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['leiloes'] && this.leiloes.length > 0) {
      console.log('Leilões no componente lista-leiloes:', this.leiloes);
      console.log('Primeiro leilão:', this.leiloes[0]);
    }
  }

  acompanhar(leilaoId: string): void {
    console.log('Acompanhar chamado com leilaoId:', leilaoId);
    this.apiService.registrarInteresse(this.usuarioId, leilaoId).subscribe({
      next: (response) => {
        alert('Interesse registrado com sucesso!');
        // Emitir evento com informação se deve conectar SSE
        this.interesseRegistrado.emit(response.deveConectarSSE);
      },
      error: (err) => {
        console.error('Erro ao registrar interesse:', err);
        alert('Erro ao registrar interesse');
      }
    });
  }

  pararDeAcompanhar(leilaoId: string): void {
    this.apiService.cancelarInteresse(this.usuarioId, leilaoId).subscribe({
      next: (response) => {
        alert('Você parou de acompanhar este leilão');
        // Emitir evento com informação se SSE foi desconectado
        this.interesseCancelado.emit(response.sseDesconectado);
      },
      error: (err) => {
        console.error('Erro ao cancelar interesse:', err);
        alert('Erro ao cancelar interesse');
      }
    });
  }
}