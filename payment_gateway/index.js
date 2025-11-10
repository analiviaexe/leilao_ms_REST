const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 4000;
// URL do ms_pagamento webhook (onde enviar status). Ajuste se o ms_pagamento estiver em outro host/porta.
const MS_PAGAMENTO_WEBHOOK = process.env.MS_PAGAMENTO_WEBHOOK || "http://localhost:5001/webhook";

/**
 * POST /pay
 * Recebe: { leilao_id, vencedor_id, valor, user_id }
 * Retorna: { payment_link, transaction_id }
 * Opcional: query param ?auto_notify_seconds=5 para simular notificação automática
 */
app.post("/pay", async (req, res) => {
  try {
    const { leilao_id, vencedor_id, valor, user_id } = req.body;
    const transaction_id = uuidv4();
    const payment_link = `http://pay.example.com/pay/${transaction_id}`;

    const autoNotifySeconds = Number(req.query.auto_notify_seconds || process.env.AUTO_NOTIFY_SECONDS || 0);

    // responde imediatamente com o link e transaction id
    res.json({ payment_link, transaction_id, webhook_expected: MS_PAGAMENTO_WEBHOOK });

    // se autoNotifySeconds > 0, simulamos o processamento e enviamos webhook depois
    if (autoNotifySeconds > 0) {
      setTimeout(async () => {
        // simular aleatoriamente aprovado/recusado — 80% aprovado por padrão
        const status = Math.random() < 0.8 ? "aprovado" : "recusado";
        const payload = {
          transaction_id,
          status,
          valor,
          user_id,
          leilao_id
        };
        try {
          console.log(`[payment-gateway] Enviando webhook para ${MS_PAGAMENTO_WEBHOOK}`, payload);
          await axios.post(MS_PAGAMENTO_WEBHOOK, payload);
          console.log("[payment-gateway] Webhook enviado com sucesso");
        } catch (err) {
          console.error("[payment-gateway] Erro ao enviar webhook:", err.message);
        }
      }, autoNotifySeconds * 1000);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar pagamento" });
  }
});

/**
 * POST /simulate
 * Usa para notificar manualmente MS_PAGAMENTO sobre um transaction_id existente.
 * Body: { transaction_id, status: 'aprovado'|'recusado', valor, user_id, leilao_id }
 */
app.post("/simulate", async (req, res) => {
  try {
    const payload = req.body;
    console.log("[payment-gateway] Simulando webhook:", payload);
    await axios.post(MS_PAGAMENTO_WEBHOOK, payload);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Payment Gateway sim rodando em http://localhost:${PORT}`);
  console.log(`MS_PAGAMENTO_WEBHOOK = ${MS_PAGAMENTO_WEBHOOK}`);
});
