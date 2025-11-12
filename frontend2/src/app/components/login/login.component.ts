import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  @Output() usuarioLogado = new EventEmitter<string>();
  usuarioId: string = '';

  entrar(): void {
    if (!this.usuarioId.trim()) {
      alert('Por favor, informe seu ID de usuário');
      return;
    }
    this.usuarioLogado.emit(this.usuarioId);
  }
}
