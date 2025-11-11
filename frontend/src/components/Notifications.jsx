import React, { useEffect, useState } from 'react';
import { connectSSE } from '../api';

export default function Notifications({ usuarioId }) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const es = connectSSE(usuarioId);

    const push = (type, data) => {
      setEvents((prev) => [...prev, { type, data, ts: new Date().toISOString() }]);
    };

    es.onmessage = (e) => push('message', e.data);

    es.addEventListener('connected', (e) => push('connected', e.data));
    es.addEventListener('interesse_registrado', (e) => push('interesse_registrado', e.data));
    es.addEventListener('interesse_cancelado', (e) => push('interesse_cancelado', e.data));
    es.addEventListener('lance_validado', (e) => push('lance_validado', e.data));
    es.addEventListener('lance_invalidado', (e) => push('lance_invalidado', e.data));
    es.addEventListener('leilao_vencedor', (e) => push('leilao_vencedor', e.data));
    es.addEventListener('link_pagamento', (e) => push('link_pagamento', e.data));
    es.addEventListener('status_pagamento', (e) => push('status_pagamento', e.data));

    es.onerror = () => push('erro', 'Falha na conexão SSE');

    return () => es.close();
  }, [usuarioId]);

  return (
    <section>
      <h2>Notificações</h2>
      <ul className="events">
        {events.map((ev, i) => {
          let content = ev.data;
          try { content = JSON.parse(ev.data); } catch {}
          return (
            <li key={i}>
              <b>{ev.type}:</b> <code>{typeof content === 'string' ? content : JSON.stringify(content)}</code>
              <span className="ts">{new Date(ev.ts).toLocaleString()}</span>
              {ev.type === 'link_pagamento' && (() => {
                const link = typeof content === 'string' ? content : content?.link;
                return link ? <a href={link} target="_blank" rel="noreferrer">Pagar</a> : null;
              })()}
            </li>
          );
        })}
      </ul>
    </section>
  );
}