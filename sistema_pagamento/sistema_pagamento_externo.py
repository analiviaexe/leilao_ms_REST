from flask import Flask, request, jsonify
from flask_cors import CORS
import threading, time, random, requests, uuid

app = Flask(__name__)
CORS(app)

# ==============================
# Função principal: criar transação
# ==============================
@app.route("/criar_transacao", methods=["POST"])
def criar_transacao():
    """
    Recebe solicitação do MS_Pagamento para iniciar uma transação.
    Retorna um link de pagamento e inicia o processo assíncrono de simulação.
    """
    dados = request.json or {}
    transacao_id = str(uuid.uuid4())
    valor = dados.get("valor", 0)
    vencedor_id = dados.get("vencedor_id", "desconhecido")
    webhook_url = dados.get("webhook_url", "")

    print("\n==============================")
    print(f"[1] 🚀 RECEBIDA SOLICITAÇÃO DE PAGAMENTO")
    print(f"→ ID Transação: {transacao_id}")
    print(f"→ Valor: R$ {valor:.2f}")
    print(f"→ Vencedor: {vencedor_id}")
    print(f"→ Webhook destino: {webhook_url}")

    link_pagamento = f"http://localhost:7000/pagar/{transacao_id}"

    print(f"[2] 🔗 Gerando link de pagamento: {link_pagamento}")
    print("==============================\n")

    # Simular processamento e envio de webhook
    threading.Thread(
        target=simular_pagamento,
        args=(transacao_id, valor, vencedor_id, webhook_url),
        daemon=True
    ).start()

    return jsonify({
        "transacao_id": transacao_id,
        "link_pagamento": link_pagamento
    }), 201


# ==============================
# Função auxiliar: simular o pagamento
# ==============================
def simular_pagamento(transacao_id, valor, vencedor_id, webhook_url):
    """
    Simula o processamento de um pagamento (aprovado ou recusado)
    e envia o webhook ao MS_Pagamento após alguns segundos.
    """
    atraso = random.randint(3, 8)
    status = random.choice(["aprovado", "recusado"])

    print(f"[3] ⏳ Simulando processamento da transação {transacao_id}...")
    print(f"→ Aguardando {atraso} segundos antes de enviar webhook...")

    time.sleep(atraso)

    payload = {
        "transacao_id": transacao_id,
        "status": status,
        "valor": valor,
        "comprador": {
            "id": vencedor_id,
            "nome": f"Usuário {vencedor_id}",
            "email": f"user{vencedor_id}@exemplo.com"
        }
    }

    print(f"\n[4] 📤 Enviando webhook ao MS_Pagamento")
    print(f"→ URL: {webhook_url}")
    print(f"→ Dados: {payload}")

    try:
        resposta = requests.post(webhook_url, json=payload, timeout=5)
        print(f"[5] ✅ Webhook enviado! Status HTTP: {resposta.status_code}")
    except Exception as e:
        print(f"[5] ❌ Erro ao enviar webhook: {e}")
    print("==============================\n")


# ==============================
# Página simulada do link de pagamento
# ==============================
@app.route("/pagar/<transacao_id>")
def pagar(transacao_id):
    """
    Página simulada acessada pelo cliente vencedor.
    """
    print(f"[💻] Usuário acessou o link de pagamento: /pagar/{transacao_id}")
    html = f"""
    <html>
      <body style="font-family: sans-serif; text-align: center; margin-top: 60px;">
        <h2>Simulação de Pagamento</h2>
        <p>Transação: <b>{transacao_id}</b></p>
        <p>O pagamento está sendo processado...</p>
        <p>(Webhook será enviado ao MS_Pagamento em alguns segundos)</p>
      </body>
    </html>
    """
    return html, 200


# ==============================
# Inicialização
# ==============================
if __name__ == "__main__":
    print("===================================")
    print("💰 SISTEMA DE PAGAMENTO EXTERNO")
    print("→ Rodando em: http://localhost:7000")
    print("→ Endpoint principal: /criar_transacao")
    print("===================================")
    app.run(host="0.0.0.0", port=7000, debug=False)
