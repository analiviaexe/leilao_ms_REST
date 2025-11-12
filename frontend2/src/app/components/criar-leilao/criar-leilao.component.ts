import { Component, EventEmitter, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-criar-leilao',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './criar-leilao.component.html',
  styleUrl: './criar-leilao.component.css'
})
export class CriarLeilaoComponent implements OnInit {
  @Output() leilaoCriado = new EventEmitter<void>();

  nome: string = '';
  descricao: string = '';
  valorInicial: number | null = null;
  inicio: string = '';
  fim: string = '';

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.preencherDatasAutomaticamente();
  }

  preencherDatasAutomaticamente(): void {
    const agora = new Date();
    const daquiUmMinuto = new Date(agora.getTime() + 60000); // +1 minuto
    
    // Formato: YYYY-MM-DDTHH:MM
    this.inicio = this.formatarDataParaInput(agora);
    this.fim = this.formatarDataParaInput(daquiUmMinuto);
  }

  formatarDataParaInput(data: Date): string {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    const horas = String(data.getHours()).padStart(2, '0');
    const minutos = String(data.getMinutes()).padStart(2, '0');
    
    return `${ano}-${mes}-${dia}T${horas}:${minutos}`;
  }

  criarLeilao(): void {
    // Validação melhorada para aceitar valorInicial = 0
    if (!this.nome || !this.descricao || this.valorInicial === null || this.valorInicial === undefined || !this.inicio || !this.fim) {
      console.log('Validação falhou:', {
        nome: this.nome,
        descricao: this.descricao,
        valorInicial: this.valorInicial,
        inicio: this.inicio,
        fim: this.fim
      });
      alert('Por favor, preencha todos os campos');
      return;
    }

    if (this.valorInicial < 0) {
      alert('Valor inicial não pode ser negativo');
      return;
    }

    // Converter datetime-local para formato Python: "YYYY-MM-DD HH:MM:SS"
    const inicioFormatado = this.converterParaFormatoPython(this.inicio);
    const fimFormatado = this.converterParaFormatoPython(this.fim);

    const leilao = {
      nome: this.nome,
      descricao: this.descricao,
      valorInicial: this.valorInicial,
      inicio: inicioFormatado,
      fim: fimFormatado
    };

    console.log('Enviando leilão:', leilao);

    this.apiService.criarLeilao(leilao).subscribe({
      next: (response) => {
        console.log('Leilão criado:', response);
        alert('Leilão criado com sucesso!');
        this.limparFormulario();
        this.leilaoCriado.emit();
      },
      error: (err) => {
        console.error('Erro ao criar leilão:', err);
        alert('Erro ao criar leilão');
      }
    });
  }

  converterParaFormatoPython(datetimeLocal: string): string {
    // datetime-local: "2025-11-11T14:30"
    // Python esperado: "2025-11-11 14:30:00"
    return datetimeLocal.replace('T', ' ') + ':00';
  }

  limparFormulario(): void {
    this.nome = '';
    this.descricao = '';
    this.valorInicial = null;
    this.preencherDatasAutomaticamente();
  }
}
