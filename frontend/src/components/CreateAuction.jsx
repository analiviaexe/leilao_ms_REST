import React, { useState } from 'react';
import { createAuction } from '../api';

export default function CreateAuction() {
  const [form, setForm] = useState({
    nome: '',
    descricao: '',
    valorInicial: '',
    inicio: '',
    fim: '',
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const payload = {
        nome: form.nome,
        descricao: form.descricao,
        valorInicial: Number(form.valorInicial),
        inicio: form.inicio, // ISO string
        fim: form.fim,       // ISO string
      };
      const r = await createAuction(payload);
      setMsg(`Leilão criado: ${r.id || payload.nome}`);
      setForm({ nome: '', descricao: '', valorInicial: '', inicio: '', fim: '' });
    } catch (err) {
      setMsg(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <h2>Criar leilão</h2>
      <form onSubmit={handleSubmit} className="form-grid">
        <input name="nome" value={form.nome} onChange={handleChange} placeholder="Nome do produto" required />
        <input name="descricao" value={form.descricao} onChange={handleChange} placeholder="Descrição" required />
        <input name="valorInicial" value={form.valorInicial} onChange={handleChange} placeholder="Valor inicial" type="number" min="0" step="0.01" required />
        <input name="inicio" value={form.inicio} onChange={handleChange} placeholder="Início (YYYY-MM-DDTHH:mm)" type="datetime-local" required />
        <input name="fim" value={form.fim} onChange={handleChange} placeholder="Fim (YYYY-MM-DDTHH:mm)" type="datetime-local" required />
        <button type="submit" disabled={loading}>{loading ? 'Criando...' : 'Criar'}</button>
      </form>
      {msg && <p className="msg">{msg}</p>}
    </section>
  );
}