// Armazena conexões SSE: userId -> response object
const sseClients = new Map();

// Armazena interesses: userId -> Set de leilaoIds
const userInterests = new Map();

function registerUserSSE(usuarioId, res) {
  sseClients.set(usuarioId, res);
  
  if (!userInterests.has(usuarioId)) {
    userInterests.set(usuarioId, new Set());
  }
  
  console.log(`[SSE] Usuário ${usuarioId} conectado`);
}

function unregisterUserSSE(usuarioId) {
  sseClients.delete(usuarioId);
  console.log(`[SSE] Usuário ${usuarioId} desconectado`);
}

function addInteresse(usuarioId, leilaoId) {
  if (!userInterests.has(usuarioId)) {
    userInterests.set(usuarioId, new Set());
  }
  userInterests.get(usuarioId).add(leilaoId);
  console.log(`[SSE] Usuário ${usuarioId} agora acompanha leilão ${leilaoId}`);
}

function removeInteresse(usuarioId, leilaoId) {
  if (userInterests.has(usuarioId)) {
    userInterests.get(usuarioId).delete(leilaoId);
    console.log(`[SSE] Usuário ${usuarioId} parou de acompanhar leilão ${leilaoId}`);
  }
}

function hasInterest(usuarioId, leilaoId) {
  return userInterests.has(usuarioId) && userInterests.get(usuarioId).has(leilaoId);
}

function isUserConnected(usuarioId) {
  return sseClients.has(usuarioId);
}

function hasAnyInterest(usuarioId) {
  return userInterests.has(usuarioId) && userInterests.get(usuarioId).size > 0;
}

function getUsersInterestedIn(leilaoId) {
  const users = [];
  for (const [userId, leiloes] of userInterests.entries()) {
    if (leiloes.has(leilaoId)) {
      users.push(userId);
    }
  }
  return users;
}

function sendSse(usuarioId, eventName, data) {
  const res = sseClients.get(usuarioId);
  if (!res) {
    console.log(`[SSE] Usuário ${usuarioId} não tem conexão SSE ativa`);
    return false;
  }
  
  try {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    console.log(`[SSE] Evento '${eventName}' enviado para usuário ${usuarioId}`);
    return true;
  } catch (err) {
    console.error(`[SSE] Erro ao enviar para ${usuarioId}:`, err.message);
    sseClients.delete(usuarioId);
    return false;
  }
}

function notifyLeilaoEvent(leilaoId, eventName, data) {
  const interestedUsers = getUsersInterestedIn(leilaoId);
  
  if (interestedUsers.length === 0) {
    console.log(`[SSE] Nenhum usuário acompanhando leilão ${leilaoId}`);
    return;
  }
  
  console.log(`[SSE] Notificando ${interestedUsers.length} usuário(s) sobre leilão ${leilaoId}`);
  
  for (const userId of interestedUsers) {
    sendSse(userId, eventName, {
      leilaoId,
      ...data
    });
  }
}

function closeConnection(usuarioId) {
  const res = sseClients.get(usuarioId);
  if (res) {
    try {
      res.end();
    } catch (e) {
      // ignore
    }
  }
  
  sseClients.delete(usuarioId);
  userInterests.delete(usuarioId);
  console.log(`[SSE] Conexão e interesses removidos para usuário ${usuarioId}`);
  return true;
}

module.exports = {
  registerUserSSE,
  unregisterUserSSE,
  addInteresse,
  removeInteresse,
  hasInterest,
  isUserConnected,
  hasAnyInterest,
  getUsersInterestedIn,
  sendSse,
  notifyLeilaoEvent,
  closeConnection
};
