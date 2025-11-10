import api from "../api";

export default function AuctionList({ auctions, userId }) {
  const registrar = async (id) => {
    try {
      await api.post(`/interesse/${userId}/${id}`);
      alert("Interesse registrado");
    } catch (err) {
      console.error(err);
      alert("Erro ao registrar interesse");
    }
  };

  const cancelar = async (id) => {
    try {
      await api.delete(`/interesse/${userId}/${id}`);
      alert("Interesse cancelado");
    } catch (err) {
      console.error(err);
      alert("Erro ao cancelar");
    }
  };

  return (
    <div>
      <h3>Leilões</h3>
      {auctions.length === 0 ? <p>Nenhum leilão</p> : auctions.map(a => (
        <div key={a.id} style={{ border: "1px solid #ccc", padding: 8, marginBottom: 8 }}>
          <div><strong>{a.descricao}</strong></div>
          <div>Início: {a.inicio} | Fim: {a.fim}</div>
          <button onClick={() => registrar(a.id)}>Registrar interesse</button>
          <button onClick={() => cancelar(a.id)}>Cancelar interesse</button>
        </div>
      ))}
    </div>
  );
}
