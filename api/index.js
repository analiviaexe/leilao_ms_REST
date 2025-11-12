const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

const app = express();

// config cors
app.use(cors({
    origin: 'http://localhost:4200',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

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
                id: l.id || l.leilaoId,
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
    res.write(`: Conectado como usuario ${usuarioId}\n\n`);
    sse.sendSse(usuarioId, 'connected', { usuarioId, timestamp: new Date().toISOString() });

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

app.post("/leiloes/interesse/:usuarioId/:leilaoId", async (req, res) => {
    const usuarioId = req.params.usuarioId;
    const leilaoId = req.params.leilaoId;

    if (!usuarioId || !leilaoId) {
        return res.status(400).json({ error: "Parâmetros obrigatórios: usuarioId, leilaoId" });
    }

    sse.addInteresse(usuarioId, leilaoId);
    
    // Buscar nome do leilão
    let leilaoNome = leilaoId;
    try {
        const leiloesResp = await axios.get(`${LEILAO_MS_URL}/leiloes/ativos`, { timeout: 2000 });
        const leilao = Array.isArray(leiloesResp.data) 
            ? leiloesResp.data.find(l => l.id == leilaoId || l.id === leilaoId)
            : null;
        if (leilao && leilao.nome) {
            leilaoNome = leilao.nome;
        }
    } catch (e) {
        console.log(e.message);
    }
    
    // se tiver sse conectado
    if (!sse.isUserConnected(usuarioId)) {
        console.log(`precisa conectar SSE`);
    } else {
        sse.sendSse(usuarioId, 'interesse_registrado', { 
            leilaoId, 
            leilaoNome,
            usuarioId,
            timestamp: new Date().toISOString() 
        });
    }

    return res.status(200).json({ 
        message: "Interesse registrado com sucesso",
        leilaoId, 
        leilaoNome,
        usuarioId,
        sseConectado: sse.isUserConnected(usuarioId),
        deveConectarSSE: !sse.isUserConnected(usuarioId)
    });
});

app.delete("/leiloes/interesse/:usuarioId/:leilaoId", (req, res) => {
    const usuarioId = req.params.usuarioId;
    const leilaoId = req.params.leilaoId;

    if (!usuarioId || !leilaoId) {
        return res.status(400).json({ error: "Parâmetros obrigatórios: usuarioId, leilaoId" });
    }

    sse.removeInteresse(usuarioId, leilaoId);

    return res.status(200).json({ 
        message: "Interesse cancelado com sucesso",
        leilaoId, 
        usuarioId,
        sseDesconectado: !temOutrosInteresses
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API Gateway listening on port ${PORT}`);
    
    conectarRabbitMQ();
});

