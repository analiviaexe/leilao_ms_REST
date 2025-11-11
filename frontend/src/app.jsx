import { useEffect, useState } from "react";
import api from "./api";
import AuctionList from "./components/AuctionList";
import CreateAuction from "./components/CreateAuction";
import BidForm from "./components/BidForm";
import Notifications from "./components/Notifications";

export default function App() {
  const [userId, setUserId] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [auctions, setAuctions] = useState([]);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!loggedIn) return;
    const es = new EventSource(`http://localhost:3000/sse/${userId}`);

    es.onmessage = (e) => {
      try {
        const dados = JSON.parse(e.data);
        setNotifications(n => [dados, ...n]);
      } catch (err) {
        console.error("SSE parse error", err);
      }
    };

    es.onerror = (err) => {
      console.error("SSE error", err);
      es.close();
    };

    return () => es.close();
  }, [loggedIn, userId]);

  const fetchAuctions = async () => {
    try {
      const res = await api.get("/leiloes/ativos");
      setAuctions(res.data);
    } catch (err) {
      console.error(err);
      alert("Erro ao buscar leilões");
    }
  };

  return (
    <div style={{ padding: 20 }}>
      {!loggedIn ? (
        <div>
          <h2>Entrar</h2>
          <input placeholder="Seu userId" value={userId} onChange={(e)=>setUserId(e.target.value)} />
          <button onClick={() => { if (!userId) { alert("Informe userId"); return;} setLoggedIn(true); fetchAuctions(); }}>Entrar</button>
        </div>
      ) : (
        <>
          <h1>Leilões</h1>
          <div style={{ display: "flex", gap: 20 }}>
            <div style={{ flex: 2 }}>
              <button onClick={fetchAuctions}>Atualizar leilões</button>
              <AuctionList auctions={auctions} userId={userId} />
              <BidForm userId={userId} />
              <CreateAuction onCreated={fetchAuctions} />
            </div>
            <div style={{ flex: 1 }}>
              <Notifications notifications={notifications} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
