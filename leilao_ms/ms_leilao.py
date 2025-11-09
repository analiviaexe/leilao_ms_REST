import pika
import json
import time
from datetime import datetime

connection = None
channel = None
running = True


agora = datetime.now()
inicio_1 = agora.replace(second=0, microsecond=0)
fim_1 = inicio_1.replace(minute=inicio_1.minute + 1)  

inicio_2 = fim_1.replace(minute=fim_1.minute)  
fim_2 = inicio_2.replace(minute=inicio_2.minute + 2)  

leiloes = [
    {
        "id": 1,
        "descricao": "notebook Dell Inspiron",
        "inicio": inicio_1.strftime("%Y-%m-%d %H:%M:%S"),
        "fim": fim_1.strftime("%Y-%m-%d %H:%M:%S"),
        "status": "pendente"
    },
    {
        "id": 2,
        "descricao": "Phone 15 Pro",
        "inicio": inicio_2.strftime("%Y-%m-%d %H:%M:%S"),
        "fim": fim_2.strftime("%Y-%m-%d %H:%M:%S"),
        "status": "pendente"
    }
]

def conectar_rabbitmq():
    global connection, channel
    try:
        connection = pika.BlockingConnection(
            pika.ConnectionParameters('localhost')
        )
        channel = connection.channel()
        
        channel.exchange_declare(exchange='leilao_iniciado', exchange_type='fanout')
        channel.exchange_declare(exchange='leilao', exchange_type='direct')
        
        return True
    except Exception:
        return False

def publicar_leilao_iniciado(leilao):
    try:
        evento = {
            "id": leilao["id"],
            "descricao": leilao["descricao"],
            "inicio": leilao["inicio"],
            "fim": leilao["fim"]
        }
        channel.basic_publish(
            exchange='leilao_iniciado',
            routing_key='',
            body=json.dumps(evento)
        )
    except Exception:
        pass

def publicar_leilao_finalizado(leilao):
    try:
        evento = {
            "id": leilao["id"],
            "descricao": leilao["descricao"],
            "timestamp": datetime.now().isoformat(),
            "status": "encerrado"
        }

        channel.basic_publish(
            exchange='leilao',
            routing_key='leilao_finalizado',
            body=json.dumps(evento)
        )
    except Exception:
        pass

def verificar_e_gerenciar_leiloes():
    global running
    agora = datetime.now()
    for leilao in leiloes:
        inicio = datetime.strptime(leilao["inicio"], "%Y-%m-%d %H:%M:%S")
        fim = datetime.strptime(leilao["fim"], "%Y-%m-%d %H:%M:%S")
        
        if leilao["status"] == "pendente" and agora >= inicio and agora < fim:
            leilao["status"] = "ativo"
            publicar_leilao_iniciado(leilao)
        elif leilao["status"] == "ativo" and agora >= fim:
            leilao["status"] = "encerrado"
            publicar_leilao_finalizado(leilao)

def main():
    global running
    
    if not conectar_rabbitmq():
        print("Erro ao conectar ao RabbitMQ")
        return
        
    try:
        while running:
            verificar_e_gerenciar_leiloes()
            time.sleep(1)
    except KeyboardInterrupt:
        running = False
        if connection and not connection.is_closed:
            connection.close()

if __name__ == "__main__":
    main()