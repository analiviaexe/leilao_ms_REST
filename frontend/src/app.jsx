import React, { useState } from 'react';
import CreateAuction from './components/CreateAuction';
import AuctionList from './components/AuctionList';
import BidForm from './components/BidForm';
import Notifications from './components/Notifications';

export default function App() {
  const [usuarioId, setUsuarioId] = useState('usuario-demo'); // pode vir de login
  const [selectedAuction, setSelectedAuction] = useState(null);

  return (
    <div className="container">
      <header>
        <h1>Sistema de Leilão</h1>
        <div className="user">
          <label>
            Usuário:
            <input value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)} />
          </label>
        </div>
      </header>

      <main className="grid">
        <div className="left">
          <CreateAuction />
          <AuctionList usuarioId={usuarioId} onSelect={setSelectedAuction} />
          <BidForm usuarioId={usuarioId} selectedAuction={selectedAuction} />
        </div>
        <div className="right">
          <Notifications usuarioId={usuarioId} />
        </div>
      </main>
    </div>
  );
}