const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(bodyParser.json());

const LEILAO_MS_URL = "http://localhost:5000";
const LANCE_MS_URL = "http://localhost:5001";

// Observações / contrato:
// - POST /leiloes: espera JSON { nome, descricao, valorInicial, inicio, fim }
//   reencaminha para o MS Leilão (o gateway adiciona um `id`).
// - GET /leiloes/ativos: consulta o MS Leilão e retorna os leilões ativos aos clientes.
// - POST /lances: espera JSON { leilaoId, usuarioId, valor } -> reencaminha ao MS Lance (adiciona id).
// - POST /leiloes/interesse/{usuarioId}/{leilaoId}: registra interesse (abre SSE)
// - DELETE /leiloes/interesse/{usuarioId}/{leilaoId}: cancela interesse (fecha SSE)
//

const sse = require('./sse_interests');

// Criar leilão: encaminha para o MS Leilão
app.post("/leiloes", async (req, res) => {
    try {
        const { nome, descricao, valorInicial, inicio, fim } = req.body || {};

        // validação mínima
        if (!nome || !descricao || !valorInicial || !inicio || !fim) {
            return res.status(400).json({ error: "Campos obrigatórios: nome, descricao, valorInicial, inicio, fim" });
        }

        const payload = {
            id: uuidv4(),
            nome,
            descricao,
            valorInicial,
            inicio,
            fim
        };

        // Encaminhar para o endpoint REST do MS Leilão
        const url = `${LEILAO_MS_URL}/leiloes`;
        const resp = await axios.post(url, payload, { timeout: 5000 });

        return res.status(resp.status).json(resp.data);
    } catch (err) {
        // Se o MS Leilão respondeu com erro HTTP, repassa o erro.
        if (err.response) {
            return res.status(err.response.status).json(err.response.data);
        }

        // Caso de falha de comunicação (timeout, conexão recusada, etc.): retornar mock
        console.error("Falha de comunicação com MS Leilão ao criar leilão:", err.message);

        const body = req.body || {};
        const mockCreated = {
            id: body.id || uuidv4(),
            nome: body.nome || null,
            descricao: body.descricao || null,
            valorInicial: body.valorInicial || null,
            inicio: body.inicio || null,
            fim: body.fim || null,
            status: "mock",
            mock: true
        };
        return res.status(201).json(mockCreated);
    }
});

app.get("/leiloes/ativos", async (req, res) => {
    try {
        // Endpoint esperado no MS Leilão: /leiloes/ativos
        const url = `${LEILAO_MS_URL}/leiloes/ativos`;
        const resp = await axios.get(url, { timeout: 5000 });

        // Retorna os campos principais em português (simples)
        const results = Array.isArray(resp.data)
            ? resp.data.map(l => ({
                nome: l.nome || l.descricao || l.id,
                descricao: l.descricao || null,
                valorInicial: l.valorInicial || l.valor_inicial || l.valor || null,
                ultimoLance: l.ultimoLance || l.ultimo_lance || null,
                inicio: l.inicio || null,
                fim: l.fim || null,
                status: l.status || null
            }))
            : resp.data;

        return res.json(results);
    } catch (err) {
        // Se o MS Leilão respondeu com erro HTTP, repassa o erro.
        if (err.response) {
            return res.status(err.response.status).json(err.response.data);
        }

        // Falha de comunicação: retornar lista mock simples
        console.error("Falha de comunicação com MS Leilão ao buscar leilões ativos:", err.message);
        const now = new Date();
        const mockList = [
            {
                id: "mock-1",
                nome: "Produto (mock)",
                descricao: "Resposta mock: falha ao comunicar com MS Leilão",
                valorInicial: 100,
                ultimoLance: null,
                inicio: now.toISOString(),
                fim: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
                status: "ativo",
                mock: true
            }
        ];
        return res.json(mockList);
    }
});

app.post("/lances", async (req, res) => {
    try {
        const { leilaoId, usuarioId, valor } = req.body || {};

        if (!leilaoId || !usuarioId || !valor) {
            return res.status(400).json({ error: "Campos obrigatórios: leilaoId, usuarioId, valor" });
        }

        const payload = {
            id: uuidv4(),
            leilaoId,
            usuarioId,
            valor,
            data: new Date().toISOString()
        };

        const url = `${LANCE_MS_URL}/lances`;
        const resp = await axios.post(url, payload, { timeout: 5000 });

        // Notificar inscritos sobre novo lance (usando retorno do MS Lance)
        try {
            await sse.notifySubscribers(leilaoId, { event: "novo_lance", lance: resp.data });
        } catch (e) {
            console.error("Erro ao notificar inscritos após lance:", e.message);
        }

        return res.status(resp.status).json(resp.data);
    } catch (err) {
        // repassa erro HTTP do MS Lance
        if (err.response) {
            return res.status(err.response.status).json(err.response.data);
        }

        // Falha de comunicação: retornar mock do lance e notificar inscritos
        console.error("Falha de comunicação com MS Lance ao efetuar lance:", err.message);

        const body = req.body || {};
        const mockLance = {
            id: uuidv4(),
            leilaoId: body.leilaoId || null,
            usuarioId: body.usuarioId || null,
            valor: body.valor || null,
            data: new Date().toISOString(),
            status: "mock",
            mock: true
        };

        // Notificar inscritos utilizando mock
        try {
            await sse.notifySubscribers(mockLance.leilaoId, { event: "novo_lance", lance: mockLance });
        } catch (e) {
            console.error("Erro ao notificar inscritos (mock):", e.message);
        }

        return res.status(201).json(mockLance);
    }
});

app.post("/leiloes/interesse/:usuarioId/:leilaoId", (req, res) => {
    const usuarioId = req.params.usuarioId;
    const leilaoId = req.params.leilaoId;

    if (!usuarioId || !leilaoId) {
        return res.status(400).json({ error: "Parâmetros obrigatórios: usuarioId, leilaoId" });
    }

    return sse.openInterestStream(leilaoId, usuarioId, req, res);
});

app.delete("/leiloes/interesse/:usuarioId/:leilaoId", (req, res) => {
    const usuarioId = req.params.usuarioId;
    const leilaoId = req.params.leilaoId;

    if (!usuarioId || !leilaoId) {
        return res.status(400).json({ error: "Parâmetros obrigatórios: usuarioId, leilaoId" });
    }

    sse.removeInteresse(leilaoId, usuarioId);
    const ack = { event: 'interesse_cancelado', leilaoId, usuarioId };
    const sent = sse.sendSse(usuarioId, 'interesse_cancelado', ack);
    if (sent) {
        try { sse.closeConnection(usuarioId); } catch (e) { /* ignore */ }
    }
    return res.status(200).json({ leilaoId, usuarioId, cancelled: true });
});

app.post("/events", async (req, res) => {
    const { type, leilaoId, clienteId, payload } = req.body || {};

    if (!type) {
        return res.status(400).json({ error: "Campo obrigatório: type" });
    }

    try {
        switch (type) {
            case "lance_validado":
            case "lance_invalidado":
            case "leilao_vencedor":
                if (!leilaoId) return res.status(400).json({ error: "Campo obrigatório: leilaoId" });

                    // Notifica apenas os inscritos registrados (SSE e/ou callback)
                    const inscritos = sse.getInteresses(leilaoId);
                    try {
                        await sse.notifySubscribers(leilaoId, { event: type, data: payload });
                    } catch (e) {
                        console.error("Erro ao notificar inscritos no evento:", e.message);
                    }
                    return res.status(200).json({ delivered: true, subscribers: inscritos.length });

            case "link_pagamento":
            case "status_pagamento":
                // Eventos de pagamento direcionados a um cliente específico
                if (!clienteId) return res.status(400).json({ error: "Campo obrigatório: clienteId" });

                const sent = sse.sendSse(clienteId, type, payload || {});
                // não temos callbacks por clienteId no registry; apenas SSE e log
                console.log(`Evento ${type} para cliente ${clienteId} enviado=${sent}`);
                return res.status(200).json({ delivered: sent });

            default:
                return res.status(400).json({ error: "Tipo de evento desconhecido" });
        }
    } catch (err) {
        console.error("Erro ao processar evento:", err.message);
        return res.status(500).json({ error: "Erro interno" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API Gateway listening on port ${PORT}`);
    console.log(`LEILAO_MS_URL=${LEILAO_MS_URL}`);
    console.log(`LANCE_MS_URL=${LANCE_MS_URL}`);
});

