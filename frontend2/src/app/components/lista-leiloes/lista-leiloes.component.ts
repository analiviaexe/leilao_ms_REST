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
  @Input() sseConectado: boolean = false;
  @Output() solicitarConexaoSSE = new EventEmitter<void>();
  @Output() interesseAdicionado = new EventEmitter<void>();
  @Output() interesseRemovido = new EventEmitter<void>();

  constructor(private apiService: ApiService) {}

  acompanhar(leilaoId: string): void {
    if (!this.sseConectado) {
      this.solicitarConexaoSSE.emit();
      
      setTimeout(() => {
        this.registrarInteresse(leilaoId);
      }, 1000);
    } else {
      this.registrarInteresse(leilaoId);
    }
  }

  private registrarInteresse(leilaoId: string): void {
    this.apiService.registrarInteresse(this.usuarioId, leilaoId).subscribe({
      next: (response) => {
        alert('Interesse registrado com sucesso!');
        this.interesseAdicionado.emit();
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
        this.interesseRemovido.emit();
      },
      error: (err) => {
        alert('Erro ao cancelar interesse');
      }
    });
  }
}