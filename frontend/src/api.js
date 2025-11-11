const API_BASE = 'http://localhost:3000';

export async function createAuction(data) {
  const res = await fetch(`${API_BASE}/leiloes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listActiveAuctions() {
  const res = await fetch(`${API_BASE}/leiloes/ativos`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function placeBid({ leilaoId, usuarioId, valor }) {
  const res = await fetch(`${API_BASE}/lances`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leilaoId, usuarioId, valor }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function registerInterest({ usuarioId, leilaoId }) {
  const res = await fetch(`${API_BASE}/leiloes/interesse/${usuarioId}/${leilaoId}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function cancelInterest({ usuarioId, leilaoId }) {
  const res = await fetch(`${API_BASE}/leiloes/interesse/${usuarioId}/${leilaoId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function connectSSE(usuarioId) {
  return new EventSource(`${API_BASE}/sse/${usuarioId}`);
}
