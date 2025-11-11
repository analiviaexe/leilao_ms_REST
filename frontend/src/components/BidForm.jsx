import React, { useState } from 'react';
import { placeBid } from '../api';

export default function BidForm({ usuarioId, selectedAuction }) {
  const [valor, setValor] = useState('');
  const [msg, setMsg] = useState(null);
  const leilaoId = selectedAuction?.id || selectedAuction?.nome;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg(null);
    try {
      const r = await placeBid({ leilaoId, usuarioId, valor: Number(valor) });
      setMsg(`Lance enviado. ID: ${r.lanceId || '—'}`);
      setValor('');
    } catch (err) {
      setMsg(`Erro ao enviar lance: ${err.message}`);
    }
  };

  if (!selectedAuction) {
    return <p>Selecione um leilão na lista para lançar.</p>;
  }

  return (
    <section>
      <h2>Lance no leilão: {selectedAuction.nome}</h2>
      <form onSubmit={handleSubmit} className="form-row">
        <input type="number" min="0" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Valor do lance" required />
        <button type="submit">Enviar lance</button>
      </form>
      {msg && <p className="msg">{msg}</p>}
    </section>
  );
}