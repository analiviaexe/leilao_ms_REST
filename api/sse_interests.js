const interesses = new Map();
const sseClients = new Map();

function getInteresses(leilaoId) {
  return interesses.get(leilaoId) || [];
}

function addInteresse(leilaoId, usuarioId) {
  const list = getInteresses(leilaoId);
  if (!list.includes(usuarioId)) {
    list.push(usuarioId);
    interesses.set(leilaoId, list);
  }
}

function removeInteresse(leilaoId, usuarioId) {
  const list = getInteresses(leilaoId).filter(u => u !== usuarioId);
  if (list.length > 0) {
    interesses.set(leilaoId, list);
  } else {
    interesses.delete(leilaoId);
  }
}

function sendSse(usuarioId, eventName, data) {
  const res = sseClients.get(usuarioId);
  if (!res) return false;
  try {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    return true;
  } catch (err) {
    console.error(`Erro ao enviar SSE para ${usuarioId}:`, err.message);
    return false;
  }
}

// abre a conexão SSE na mesma requisição de registro
function openInterestStream(leilaoId, usuarioId, req, res) {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.flushHeaders();

  res.write(`: conectado ao interesse ${leilaoId}\n\n`);

  addInteresse(leilaoId, usuarioId);
  sseClients.set(usuarioId, res);
  console.log(`Interesse registrado e SSE aberto para usuario ${usuarioId} no leilao ${leilaoId}`);

  const ack = { event: 'interesse_registrado', leilaoId, usuarioId };
  res.write(`event: interesse_registrado\n`);
  res.write(`data: ${JSON.stringify(ack)}\n\n`);

  const keepAlive = setInterval(() => {
    try { res.write(':\n\n'); } catch (e) { /* ignore */ }
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(usuarioId);
    removeInteresse(leilaoId, usuarioId);
    console.log(`Conexao SSE fechada para usuario ${usuarioId}; interesse removido do leilao ${leilaoId}`);
  });

  return { usuarioId, leilaoId };
}

function closeConnection(usuarioId) {
  const res = sseClients.get(usuarioId);
  if (!res) return false;
  try {
    res.end();
  } catch (e) {
    // ignore
  }
  sseClients.delete(usuarioId);
  return true;
}

// Notifica inscritos via SSE
async function notifySubscribers(leilaoId, eventPayload) {
  const subs = getInteresses(leilaoId);
  if (!subs.length) {
    console.log(`Nenhum inscrito para leilao ${leilaoId}`);
    return;
  }
  for (const usuarioId of subs) {
    const sseSent = sendSse(usuarioId, eventPayload.event || 'evento', eventPayload);
    if (sseSent) {
      console.log(`SSE enviado para ${usuarioId} sobre leilao ${leilaoId}`);
    } else {
      console.log(`Inscrito ${usuarioId} (sem conexão SSE) perderia evento:`, eventPayload);
    }
  }
}

module.exports = {
  getInteresses,
  addInteresse,
  removeInteresse,
  openInterestStream,
  closeConnection,
  sendSse,
  notifySubscribers
};
