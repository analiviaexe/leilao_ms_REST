// Armazena conexões SSE: userId -> response object
const sseClients = new Map();

// Armazena interesses: userId -> Set de leilaoIds
const userInterests = new Map();

/**
 * Registra conexão SSE de um usuário (canal único)
 */
function registerUserSSE(usuarioId, res) {
  sseClients.set(usuarioId, res);
  
  // Inicializa Set de interesses se não existir
  if (!userInterests.has(usuarioId)) {
    userInterests.set(usuarioId, new Set());
  }
  
  console.log(`[SSE] Usuário ${usuarioId} conectado`);
}

/**
 * Remove conexão SSE de um usuário
 */
function unregisterUserSSE(usuarioId) {
  sseClients.delete(usuarioId);
  console.log(`[SSE] Usuário ${usuarioId} desconectado`);
}

/**
 * Adiciona interesse de um usuário em um leilão
 */
function addInteresse(usuarioId, leilaoId) {
  if (!userInterests.has(usuarioId)) {
    userInterests.set(usuarioId, new Set());
  }
  userInterests.get(usuarioId).add(leilaoId);
  console.log(`[SSE] Usuário ${usuarioId} agora acompanha leilão ${leilaoId}`);
}

/**
 * Remove interesse de um usuário em um leilão
 */
function removeInteresse(usuarioId, leilaoId) {
  if (userInterests.has(usuarioId)) {
    userInterests.get(usuarioId).delete(leilaoId);
    console.log(`[SSE] Usuário ${usuarioId} parou de acompanhar leilão ${leilaoId}`);
  }
}

/**
 * Verifica se usuário tem interesse em um leilão
 */
function hasInterest(usuarioId, leilaoId) {
  return userInterests.has(usuarioId) && userInterests.get(usuarioId).has(leilaoId);
}

/**
 * Verifica se usuário tem conexão SSE ativa
 */
function isUserConnected(usuarioId) {
  return sseClients.has(usuarioId);
}

/**
 * Verifica se usuário tem algum interesse ativo
 */
function hasAnyInterest(usuarioId) {
  return userInterests.has(usuarioId) && userInterests.get(usuarioId).size > 0;
}

/**
 * Retorna todos os usuários interessados em um leilão
 */
function getUsersInterestedIn(leilaoId) {
  const users = [];
  for (const [userId, leiloes] of userInterests.entries()) {
    if (leiloes.has(leilaoId)) {
      users.push(userId);
    }
  }
  return users;
}

/**
 * Envia evento SSE para um usuário específico
 */
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

/**
 * Notifica todos os usuários interessados em um leilão
 * (Filtra apenas quem registrou interesse)
 */
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

/**
 * Remove conexão SSE de um usuário e limpa seus interesses
 */
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
