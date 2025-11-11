const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(bodyParser.json());

const LEILAO_MS_URL = "http://localhost:5000";
const LANCE_MS_URL = "http://localhost:5001";

const sse = require('./sse_interests');
const { conectarRabbitMQ } = require('./rabbitmq_consumer');

app.post("/leiloes", async (req, res) => {
    try {
        const { nome, descricao, valorInicial, inicio, fim } = req.body || {};

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

        const url = `${LEILAO_MS_URL}/leiloes`;
        const resp = await axios.post(url, payload, { timeout: 5000 });

        return res.status(resp.status).json(resp.data);
    } catch (err) {
        if (err.response) {
            return res.status(err.response.status).json(err.response.data);
        }
        return res.status(201).json(mockCreated);
    }
});

app.get("/leiloes/ativos", async (req, res) => {
    try {
        const url = `${LEILAO_MS_URL}/leiloes/ativos`;
        const resp = await axios.get(url, { timeout: 5000 });

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
        if (err.response) {
            return res.status(err.response.status).json(err.response.data);
        }
        return res.json(mockList);
    }
});

app.post("/lances", async (req, res) => {
    try {
        const { leilaoId, usuarioId, valor } = req.body || {};

        if (!leilaoId || !usuarioId || !valor) {
            return res.status(400).json({ error: "Campos obrigatórios: leilaoId, usuarioId, valor" });
        }

        // Validar se o leilão está ativo antes de aceitar o lance
        try {
            const leiloesAtivosUrl = `${LEILAO_MS_URL}/leiloes/ativos`;
            const leiloesResp = await axios.get(leiloesAtivosUrl, { timeout: 3000 });
            const leiloesAtivos = leiloesResp.data || [];
            
            const leilaoAtivo = leiloesAtivos.find(l => l.id === leilaoId);
            
            if (!leilaoAtivo) {
                return res.status(400).json({
                    error: "Leilão não está ativo",
                    message: "O leilão não existe, ainda não iniciou ou já foi encerrado",
                    leilaoId
                });
            }
        } catch (validationErr) {
            console.error("Erro ao validar status do leilão:", validationErr.message);
            // Se falhar a validação, deixa passar (fail-safe)
        }

        const payload = {
            id: uuidv4(),
            leilaoId,
            usuarioId,
            valor,
            data: new Date().toISOString()
        };

        const url = `${LANCE_MS_URL}/lances`;
        await axios.post(url, payload, { timeout: 5000 });

        return res.status(202).json({
            message: "Lance aceito para processamento",
            lanceId: payload.id
        });
    } catch (err) {
        if (err.response) {
            return res.status(err.response.status).json(err.response.data);
        }

        return res.status(503).json({
            error: "Serviço de lances indisponível",
            message: err.message
        });
    }
});

app.get("/sse/:usuarioId", (req, res) => {
    const usuarioId = req.params.usuarioId;

    if (!usuarioId) {
        return res.status(400).json({ error: "Parâmetro obrigatório: usuarioId" });
    }

    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });
    res.flushHeaders();

    sse.registerUserSSE(usuarioId, res);
    res.write(`: Conectado como usuário ${usuarioId}\n\n`);
    sse.sendSse(usuarioId, 'connected', { usuarioId, timestamp: new Date().toISOString() });

    // verifica conexao a cada 25 segundos
    const keepAlive = setInterval(() => {
        try {
            res.write(':\n\n');
        } catch (e) {
            clearInterval(keepAlive);
        }
    }, 25000);

    req.on('close', () => {
        clearInterval(keepAlive);
        sse.unregisterUserSSE(usuarioId);
    });
});

app.post("/leiloes/interesse/:usuarioId/:leilaoId", (req, res) => {
    const usuarioId = req.params.usuarioId;
    const leilaoId = req.params.leilaoId;

    if (!usuarioId || !leilaoId) {
        return res.status(400).json({ error: "Parâmetros obrigatórios: usuarioId, leilaoId" });
    }

    sse.addInteresse(usuarioId, leilaoId);
    
    sse.sendSse(usuarioId, 'interesse_registrado', { 
        leilaoId, 
        usuarioId,
        timestamp: new Date().toISOString() 
    });

    return res.status(200).json({ 
        message: "Interesse registrado com sucesso",
        leilaoId, 
        usuarioId 
    });
});

app.delete("/leiloes/interesse/:usuarioId/:leilaoId", (req, res) => {
    const usuarioId = req.params.usuarioId;
    const leilaoId = req.params.leilaoId;

    if (!usuarioId || !leilaoId) {
        return res.status(400).json({ error: "Parâmetros obrigatórios: usuarioId, leilaoId" });
    }

    sse.removeInteresse(usuarioId, leilaoId);
    
    sse.sendSse(usuarioId, 'interesse_cancelado', { 
        leilaoId, 
        usuarioId,
        timestamp: new Date().toISOString() 
    });

    return res.status(200).json({ 
        message: "Interesse cancelado com sucesso",
        leilaoId, 
        usuarioId, 
        cancelled: true 
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API Gateway listening on port ${PORT}`);
    console.log(`LEILAO_MS_URL=${LEILAO_MS_URL}`);
    console.log(`LANCE_MS_URL=${LANCE_MS_URL}`);
    
    conectarRabbitMQ();
});

