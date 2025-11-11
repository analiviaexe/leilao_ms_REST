import React, { useEffect, useState } from 'react';
import { listActiveAuctions, registerInterest, cancelInterest } from '../api';

export default function AuctionList({ usuarioId, onSelect }) {
  const [auctions, setAuctions] = useState([]);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    try {
      const data = await listActiveAuctions();
      setAuctions(Array.isArray(data) ? data : []);
    } catch (err) {
      setMsg(`Erro ao carregar leilões: ${err.message}`);
    }
  };

  useEffect(() => { load(); }, []);

  const handleRegister = async (leilaoId) => {
    try {
      await registerInterest({ usuarioId, leilaoId });
      setMsg(`Interesse registrado no leilão ${leilaoId}`);
    } catch (err) {
      setMsg(`Erro ao registrar interesse: ${err.message}`);
    }
  };

  const handleCancel = async (leilaoId) => {
    try {
      await cancelInterest({ usuarioId, leilaoId });
      setMsg(`Interesse cancelado no leilão ${leilaoId}`);
    } catch (err) {
      setMsg(`Erro ao cancelar interesse: ${err.message}`);
    }
  };

  return (
    <section>
      <h2>Leilões ativos</h2>
      {msg && <p className="msg">{msg}</p>}
      <div className="list">
        {auctions.map((a, i) => (
          <div key={a.id || i} className="card">
            <div className="card-header">
              <strong>{a.nome}</strong>
            </div>
            <div className="card-body">
              <p>{a.descricao}</p>
              <p><b>Valor inicial:</b> {a.valorInicial ?? '—'}</p>
              <p><b>Último lance:</b> {a.ultimoLance ?? '—'}</p>
              <p><b>Início:</b> {a.inicio}</p>
              <p><b>Fim:</b> {a.fim}</p>
            </div>
            <div className="card-actions">
              <button onClick={() => onSelect(a)}>Selecionar</button>
              <button onClick={() => handleRegister(a.id || a.nome)}>Registrar interesse</button>
              <button onClick={() => handleCancel(a.id || a.nome)}>Cancelar interesse</button>
            </div>
          </div>
        ))}
        {auctions.length === 0 && <p>Nenhum leilão ativo.</p>}
      </div>
    </section>
  );
}