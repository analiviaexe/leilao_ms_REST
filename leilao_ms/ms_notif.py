import pika
import json
from datetime import datetime

connection = None
channel = None
running = True

def conectar_rabbitmq():
    global connection, channel
    try:
        connection = pika.BlockingConnection(
            pika.ConnectionParameters('localhost')
        )
        channel = connection.channel()
        
        channel.exchange_declare(exchange='leilao', exchange_type='direct')
        channel.exchange_declare(exchange='notificacoes_leilao', exchange_type='direct')
        
        channel.queue_declare(queue='lance_validado', durable=True)
        channel.queue_declare(queue='leilao_vencedor', durable=True)

        channel.queue_bind(exchange='leilao', queue='lance_validado', routing_key='lance_validado')
        channel.queue_bind(exchange='leilao', queue='leilao_vencedor', routing_key='leilao_vencedor')
        
        return True
    except Exception:
        return False

def callback_lance_validado(ch, method, properties, body):
    try:
        evento = json.loads(body)
        leilao_id = evento.get('leilao_id')
        
        if leilao_id:
            notificacao = {
                "tipo": "novo_lance",
                "leilao_id": leilao_id,
                "user_id": evento.get('user_id'),
                "valor": evento.get('valor'),
                "timestamp": datetime.now().isoformat()
            }
            
            channel.basic_publish(
                exchange='notificacoes_leilao',
                routing_key=f'leilao_{leilao_id}',
                body=json.dumps(notificacao)
            )
                
    except Exception as e:
        print(f"Erro ao processar lance validado: {e}")
    
    ch.basic_ack(delivery_tag=method.delivery_tag)

def callback_leilao_vencedor(ch, method, properties, body):
    try:
        evento = json.loads(body)
        leilao_id = evento.get('leilao_id')
        
        if leilao_id:
            notificacao = {
                "tipo": "leilao_vencedor",
                "leilao_id": leilao_id,
                "vencedor_id": evento.get('vencedor_id'),
                "valor_final": evento.get('valor_final'),
                "timestamp": datetime.now().isoformat()
            }
            
            channel.basic_publish(
                exchange='notificacoes_leilao',
                routing_key=f'leilao_{leilao_id}',
                body=json.dumps(notificacao)
            )
            
    except Exception as e:
        print(f"Erro ao processar leilão vencedor: {e}")
    
    ch.basic_ack(delivery_tag=method.delivery_tag)

def iniciar_consumidores():
    channel.basic_consume(
        queue='lance_validado',
        on_message_callback=callback_lance_validado,
        auto_ack=False
    )
    
    channel.basic_consume(
        queue='leilao_vencedor',
        on_message_callback=callback_leilao_vencedor,
        auto_ack=False
    )

def main():
    global running
    
    if not conectar_rabbitmq():
        print("Erro ao conectar ao RabbitMQ")
        return
    
    iniciar_consumidores()
    
    try:
        channel.start_consuming()
    except KeyboardInterrupt:
        running = False
        try:
            if channel:
                channel.stop_consuming()
            if connection and not connection.is_closed:
                connection.close()
        except Exception:
            pass

if __name__ == "__main__":
    main()
