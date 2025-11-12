from flask import Flask, request, jsonify
from flask_cors import CORS
import threading, time, random, requests, uuid

app = Flask(__name__)
CORS(app)


@app.route("/criar_transacao", methods=["POST"])
def criar_transacao():

    dados = request.json or {}
    transacao_id = str(uuid.uuid4())
    valor = dados.get("valor", 0)
    vencedor_id = dados.get("vencedor_id", "desconhecido")
    webhook_url = dados.get("webhook_url", "")

    link_pagamento = f"http://localhost:7000/pagar/{transacao_id}"

    threading.Thread(
        target=simular_pagamento,
        args=(transacao_id, valor, vencedor_id, webhook_url),
        daemon=True
    ).start()

    return jsonify({
        "transacao_id": transacao_id,
        "link_pagamento": link_pagamento
    }), 201


def simular_pagamento(transacao_id, valor, vencedor_id, webhook_url):

    payload = {
        "transacao_id": transacao_id,
        "status": "aprovado",
        "valor": valor,
        "comprador": {
            "id": vencedor_id,
            "nome": f"Usuário {vencedor_id}",
            "email": f"user{vencedor_id}@exemplo.com"
        }
    }

    try:
        resposta = requests.post(webhook_url, json=payload, timeout=5)
    except Exception as e:
        return

        

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=7000, debug=False)
