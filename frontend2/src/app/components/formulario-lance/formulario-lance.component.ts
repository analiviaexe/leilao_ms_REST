import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Leilao } from '../../models/models';

@Component({
  selector: 'app-formulario-lance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './formulario-lance.component.html',
  styleUrl: './formulario-lance.component.css'
})
export class FormularioLanceComponent {
  @Input() usuarioId: string = '';
  @Input() leiloes: Leilao[] = [];
  
  leilaoId: string = '';
  valor: number | null = null;

  constructor(private apiService: ApiService) {}

  get leiloesAtivos(): Leilao[] {
    return this.leiloes.filter(l => l.status === 'ativo');
  }

  enviarLance(): void {
    if (!this.leilaoId.trim() || !this.valor || this.valor <= 0) {
      alert('Por favor, selecione um leilão e informe um valor válido');
      return;
    }

    const leilaoSelecionado = this.leiloesAtivos.find(l => l.id == this.leilaoId);
    if (!leilaoSelecionado) {
      alert('Leilão não está ativo! Por favor, atualize a lista de leilões.');
      return;
    }

    this.apiService.enviarLance({
      leilaoId: this.leilaoId,
      usuarioId: this.usuarioId,
      valor: this.valor
    }).subscribe({
      next: (response) => {
        alert('Lance enviado com sucesso!');
        this.limparFormulario();
      },
      error: (err) => {
        const mensagem = err.error?.error || 'Erro ao enviar lance';
        alert(mensagem);
      }
    });
  }

  limparFormulario(): void {
    this.leilaoId = '';
    this.valor = null;
  }
}
