import pika, json, threading, requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
CORS(app)

RABBITMQ_HOST = "localhost"
SISTEMA_PAGAMENTO_URL = "http://localhost:7000/criar_transacao"
WEBHOOK_URL = "http://localhost:5002/webhook_pagamento"


def conectar_rabbitmq():
    connection = pika.BlockingConnection(pika.ConnectionParameters(RABBITMQ_HOST))
    channel = connection.channel()
    channel.exchange_declare(exchange='leilao', exchange_type='direct')
    channel.queue_declare(queue='leilao_vencedor', durable=True)
    channel.queue_bind(exchange='leilao', queue='leilao_vencedor', routing_key='leilao_vencedor')
    return connection, channel



def callback_leilao_vencedor(ch, method, properties, body):
    evento = json.loads(body)

    dados_pagamento = {
        "leilao_id": evento["leilao_id"],
        "vencedor_id": evento["vencedor_id"],
        "valor": evento["valor_final"],
        "webhook_url": WEBHOOK_URL
    }

    try:
        resposta = requests.post(SISTEMA_PAGAMENTO_URL, json=dados_pagamento, timeout=5)

        if resposta.status_code != 201:
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return

        data = resposta.json()
        link = data.get("link_pagamento")
        transacao_id = data.get("transacao_id")


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

    except Exception as e:
        return

    ch.basic_ack(delivery_tag=method.delivery_tag)




@app.route('/webhook_pagamento', methods=['POST'])
def receber_webhook():
    dados = request.json

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


    connection.close()
    return jsonify({"message": "Webhook processado com sucesso"}), 200



def consumidor_thread():
    connection, channel = conectar_rabbitmq()
    channel.basic_consume(queue='leilao_vencedor', on_message_callback=callback_leilao_vencedor)
    channel.start_consuming()


def main():
    threading.Thread(target=consumidor_thread, daemon=True).start()
    app.run(host="0.0.0.0", port=5002, debug=False)


if __name__ == "__main__":
    main()
