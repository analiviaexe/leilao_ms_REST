import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Leilao } from '../../models/models';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-lista-leiloes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lista-leiloes.component.html',
  styleUrl: './lista-leiloes.component.css'
})
export class ListaLeiloesComponent {
  @Input() leiloes: Leilao[] = [];
  @Input() usuarioId: string = '';
  @Output() interesseRegistrado = new EventEmitter<boolean>();
  @Output() interesseCancelado = new EventEmitter<boolean>();

  constructor(private apiService: ApiService) {}

  acompanhar(leilaoId: string): void {
    this.apiService.registrarInteresse(this.usuarioId, leilaoId).subscribe({
      next: (response) => {
        alert('Interesse registrado com sucesso!');
        this.interesseRegistrado.emit(response.deveConectarSSE);
      },
      error: (err) => {
        alert('Erro ao registrar interesse');
      }
    });
  }

  pararDeAcompanhar(leilaoId: string): void {
    this.apiService.cancelarInteresse(this.usuarioId, leilaoId).subscribe({
      next: (response) => {
        alert('Você parou de acompanhar este leilão');
        this.interesseCancelado.emit(response.sseDesconectado);
      },
      error: (err) => {
        alert('Erro ao cancelar interesse');
      }
    });
  }
}