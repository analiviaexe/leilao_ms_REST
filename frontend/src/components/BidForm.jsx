import { useState } from "react";
import api from "../api";

export default function BidForm({ userId }) {
  const [leilaoId, setLeilaoId] = useState("");
  const [valor, setValor] = useState("");

  const enviar = async () => {
    if (!leilaoId || !valor) { alert("Preencha id e valor"); return; }
    try {
      await api.post("/lance", { leilao_id: Number(leilaoId), user_id: userId, valor: Number(valor) });
      alert("Lance enviado");
      setValor("");
    } catch (err) {
      console.error(err);
      alert("Erro ao enviar lance");
    }
  };

  return (
    <div>
      <h3>Dar lance</h3>
      <input placeholder="leilaoId" value={leilaoId} onChange={(e)=>setLeilaoId(e.target.value)} />
      <input placeholder="valor" value={valor} onChange={(e)=>setValor(e.target.value)} />
      <button onClick={enviar}>Enviar lance</button>
    </div>
  );
}
