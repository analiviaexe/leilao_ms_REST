import pika, json, threading, requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime

# ==============================
# Configuração básica
# ==============================
app = Flask(__name__)
CORS(app)

RABBITMQ_HOST = "localhost"
SISTEMA_PAGAMENTO_URL = "http://localhost:7000/criar_transacao"
WEBHOOK_URL = "http://localhost:5002/webhook_pagamento"


# ==============================
# Conexão com RabbitMQ
# ==============================
def conectar_rabbitmq():
    connection = pika.BlockingConnection(pika.ConnectionParameters(RABBITMQ_HOST))
    channel = connection.channel()
    channel.exchange_declare(exchange='leilao', exchange_type='direct')
    channel.queue_declare(queue='leilao_vencedor', durable=True)
    channel.queue_bind(exchange='leilao', queue='leilao_vencedor', routing_key='leilao_vencedor')
    return connection, channel


# ==============================
# Callback: evento leilao_vencedor
# ==============================
def callback_leilao_vencedor(ch, method, properties, body):
    evento = json.loads(body)
    print("\n==============================")
    print(f"[1] 🏆 Evento 'leilao_vencedor' recebido do RabbitMQ")
    print(f"→ Leilão ID: {evento.get('leilao_id')}")
    print(f"→ Vencedor: {evento.get('vencedor_id')}")
    print(f"→ Valor final: R$ {evento.get('valor_final')}")
    print("==============================")

    dados_pagamento = {
        "leilao_id": evento["leilao_id"],
        "vencedor_id": evento["vencedor_id"],
        "valor": evento["valor_final"],
        "webhook_url": WEBHOOK_URL
    }

    try:
        print(f"[2] 🔗 Enviando requisição REST ao sistema externo ({SISTEMA_PAGAMENTO_URL})")
        resposta = requests.post(SISTEMA_PAGAMENTO_URL, json=dados_pagamento, timeout=5)

        if resposta.status_code != 201:
            print(f"[❌] Erro: sistema externo retornou código {resposta.status_code}")
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return

        data = resposta.json()
        link = data.get("link_pagamento")
        transacao_id = data.get("transacao_id")

        print(f"[3] ✅ Sistema externo respondeu:")
        print(f"→ Transação: {transacao_id}")
        print(f"→ Link de pagamento: {link}")

        # Publicar evento link_pagamento
        evento_link = {
            "leilao_id": evento["leilao_id"],
            "vencedor_id": evento["vencedor_id"],
            "link": link,
            "timestamp": datetime.now().isoformat()
        }

        ch.basic_publish(
            exchange='leilao',
            routing_key='link_pagamento',
            body=json.dumps(evento_link)
        )
        print(f"[4] 📢 Evento 'link_pagamento' publicado no RabbitMQ")
        print(f"→ {evento_link}")

    except Exception as e:
        print(f"[❌] Erro ao criar pagamento: {e}")

    ch.basic_ack(delivery_tag=method.delivery_tag)
    print("==============================\n")


# ==============================
# Endpoint de webhook (notificação externa)
# ==============================
@app.route('/webhook_pagamento', methods=['POST'])
def receber_webhook():
    dados = request.json
    print("\n==============================")
    print(f"[5] 📬 Webhook recebido do sistema de pagamento externo")
    print(f"→ Transação: {dados.get('transacao_id')}")
    print(f"→ Status: {dados.get('status')}")
    print(f"→ Valor: R$ {dados.get('valor')}")
    print("==============================")

    connection = pika.BlockingConnection(pika.ConnectionParameters(RABBITMQ_HOST))
    channel = connection.channel()
    channel.exchange_declare(exchange='leilao', exchange_type='direct')

    evento_status = {
        "leilao_id": dados.get("leilao_id"),
        "vencedor_id": dados.get("comprador", {}).get("id"),
        "status": dados.get("status"),
        "timestamp": datetime.now().isoformat()
    }

    channel.basic_publish(
        exchange='leilao',
        routing_key='status_pagamento',
        body=json.dumps(evento_status)
    )

    print(f"[6] 📨 Evento 'status_pagamento' publicado no RabbitMQ")
    print(f"→ {evento_status}")
    print("==============================\n")

    connection.close()
    return jsonify({"message": "Webhook processado com sucesso"}), 200


# ==============================
# Thread de consumo RabbitMQ
# ==============================
def consumidor_thread():
    connection, channel = conectar_rabbitmq()
    channel.basic_consume(queue='leilao_vencedor', on_message_callback=callback_leilao_vencedor)
    print("===================================")
    print("💳 MS_PAGAMENTO")
    print("→ Aguardando eventos 'leilao_vencedor'...")
    print("→ Endpoint Webhook: /webhook_pagamento")
    print("===================================")
    channel.start_consuming()


# ==============================
# Inicialização
# ==============================
def main():
    threading.Thread(target=consumidor_thread, daemon=True).start()
    app.run(host="0.0.0.0", port=5002, debug=False)


if __name__ == "__main__":
    main()
