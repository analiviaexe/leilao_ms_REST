export interface Leilao {
  id: any;
  nome: string;
  valorInicial: number;
  ultimoLance?: number;
  status: string;
  descricao: string;
}

export interface Lance {
  leilaoId: any;
  usuarioId: string;
  valor: number;
}

export interface Notificacao {
  tipo: string;
  mensagem: string;
  timestamp?: string;
}
