import { useState } from "react";
import api from "../api";

export default function CreateAuction({ onCreated }) {
  const [descricao, setDescricao] = useState("");

  const criar = async () => {
    try {
      await api.post("/leiloes", { descricao, inicio: new Date().toISOString(), fim: new Date(Date.now()+60*60*1000).toISOString() });
      alert("Leilão criado");
      setDescricao("");
      if (onCreated) onCreated();
    } catch (err) {
      console.error(err);
      alert("Erro ao criar leilão");
    }
  };

  return (
    <div>
      <h3>Criar leilão</h3>
      <input placeholder="Descrição" value={descricao} onChange={(e)=>setDescricao(e.target.value)} />
      <button onClick={criar}>Criar</button>
    </div>
  );
}
