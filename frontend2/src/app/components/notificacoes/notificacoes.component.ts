import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Notificacao } from '../../models/models';

@Component({
  selector: 'app-notificacoes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notificacoes.component.html',
  styleUrl: './notificacoes.component.css'
})
export class NotificacoesComponent {
  @Input() notificacoes: Notificacao[] = [];
  @Input() conectado: boolean = false;

  formatarHora(timestamp?: string): string {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString('pt-BR');
  }
}
