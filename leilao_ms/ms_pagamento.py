from flask import Flask, request, jsonify
import pika
import json
import threading
import requests
import time
import os

RABBIT_URL = os.getenv("RABBIT_URL", "amqp://localhost")
EXTERNAL_PAYMENT_URL = os.getenv("EXTERNAL_PAYMENT_URL", "http://localhost:4000/pay")
WEBHOOK_PORT = int(os.getenv("WEBHOOK_PORT", 5001))

app = Flask(__name__)

connection = None
channel = None

def connect_rabbit():
    global connection, channel
    params = pika.URLParameters(RABBIT_URL)
    connection = pika.BlockingConnection(params)
    channel = connection.channel()
    channel.exchange_declare(exchange='leilao', exchange_type='direct', durable=False)
    q = channel.queue_declare(queue='', exclusive=True)
    queue_name = q.method.queue
    channel.queue_bind(exchange='leilao', queue=queue_name, routing_key='leilao_vencedor')

    def callback(ch, method, properties, body):
        try:
            evento = json.loads(body.decode())
            print(f"[ms_pagamento] Evento leilao_vencedor recebido: {evento}")
            handle_leilao_vencedor(evento)
        except Exception as e:
            print("Erro processando leilao_vencedor:", e)
        finally:
            ch.basic_ack(delivery_tag=method.delivery_tag)

    channel.basic_consume(queue=queue_name, on_message_callback=callback, auto_ack=False)
    print("[ms_pagamento] Conectado ao RabbitMQ, aguardando leilao_vencedor...")
    channel.start_consuming()

def handle_leilao_vencedor(evento):
    """
    evento: { leilao_id, vencedor_id, valor_final, timestamp, ... }
    Vamos chamar o sistema externo para gerar link de pagamento.
    """
    payload = {
        "leilao_id": evento.get("leilao_id"),
        "vencedor_id": evento.get("vencedor_id"),
        "valor": evento.get("valor_final") or evento.get("valor") or evento.get("valor_total"),
        "user_id": evento.get("vencedor_id")
    }

    try:
        resp = requests.post(EXTERNAL_PAYMENT_URL, json=payload, timeout=5)
        resp.raise_for_status()
        data = resp.json()
        payment_link = data.get("payment_link")
        transaction_id = data.get("transaction_id")
        evento_link = {
            "leilao_id": payload["leilao_id"],
            "vencedor_id": payload["vencedor_id"],
            "valor": payload["valor"],
            "payment_link": payment_link,
            "transaction_id": transaction_id,
            "user_id": payload.get("user_id")
        }
        channel.basic_publish(
            exchange='leilao',
            routing_key='link_pagamento',
            body=json.dumps(evento_link).encode()
        )
        print("[ms_pagamento] Publicado link_pagamento:", evento_link)
    except Exception as e:
        print("[ms_pagamento] Erro ao chamar sistema externo:", e)

@app.route("/webhook", methods=["POST"])
def webhook():
    """
    Recebe notificações do sistema externo:
    { transaction_id, status: 'aprovado'|'recusado', valor, user_id, leilao_id }
    Publica evento 'status_pagamento' no exchange 'leilao' com routing 'status_pagamento'
    """
    try:
        payload = request.get_json()
        print("[ms_pagamento] Webhook recebido:", payload)
        event = {
            "transaction_id": payload.get("transaction_id"),
            "status": payload.get("status"),
            "valor": payload.get("valor"),
            "user_id": payload.get("user_id"),
            "leilao_id": payload.get("leilao_id")
        }
        channel.basic_publish(
            exchange='leilao',
            routing_key='status_pagamento',
            body=json.dumps(event).encode()
        )
        return jsonify({"ok": True}), 200
    except Exception as e:
        print("Erro no webhook:", e)
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    t = threading.Thread(target=connect_rabbit, daemon=True)
    t.start()
    app.run(host="0.0.0.0", port=WEBHOOK_PORT)