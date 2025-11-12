// Armazena conexões SSE: userId -> response object
const sseClients = new Map();

// Armazena interesses: userId -> Set de leilaoIds
const userInterests = new Map();

function registerUserSSE(usuarioId, res) {
  sseClients.set(usuarioId, res);
  
  if (!userInterests.has(usuarioId)) {
    userInterests.set(usuarioId, new Set());
  }
  
  console.log(`usuario ${usuarioId} conectado`);
}

function unregisterUserSSE(usuarioId) {
  sseClients.delete(usuarioId);
  console.log(`usuario ${usuarioId} desconectado`);
}

function addInteresse(usuarioId, leilaoId) {
  if (!userInterests.has(usuarioId)) {
    userInterests.set(usuarioId, new Set());
  }
  userInterests.get(usuarioId).add(leilaoId);
  console.log(`usuario ${usuarioId} agora acompanha leilão ${leilaoId}`);
}

function removeInteresse(usuarioId, leilaoId) {
  if (userInterests.has(usuarioId)) {
    userInterests.get(usuarioId).delete(leilaoId);
    console.log(`usuario ${usuarioId} parou de acompanhar leilão ${leilaoId}`);
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
    console.log(`usuario ${usuarioId} não tem conexão SSE ativa`);
    return false;
  }
  
  try {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    console.log(`evento '${eventName}' enviado para usuário ${usuarioId}`);
    return true;
  } catch (err) {
    console.error(`erro ao enviar para ${usuarioId}:`, err.message);
    sseClients.delete(usuarioId);
    return false;
  }
}

function notifyLeilaoEvent(leilaoId, eventName, data) {
  const interestedUsers = getUsersInterestedIn(leilaoId);
  
  if (interestedUsers.length === 0) {
    console.log(`nenhum usuário acompanhando leilão ${leilaoId}`);
    return;
  }
    
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
