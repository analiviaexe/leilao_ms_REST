import pika
import json
import os
from datetime import datetime
from Crypto.PublicKey import RSA
from Crypto.Signature import pkcs1_15
from Crypto.Hash import SHA256
import base64

connection = None
channel = None
running = True
leiloes_ativos = {}
lances_por_leilao = {}

def conectar_rabbitmq():
    global connection, channel
    try:
        connection = pika.BlockingConnection(
            pika.ConnectionParameters('localhost')
        )
        channel = connection.channel()
        
        channel.exchange_declare(exchange='leilao_iniciado', exchange_type='fanout')
        channel.exchange_declare(exchange='leilao', exchange_type='direct')
        
        channel.queue_declare(queue='lance_realizado', durable=True)
        channel.queue_declare(queue='leilao_finalizado', durable=True)
        
        result = channel.queue_declare(queue='', exclusive=True)
        queue_leilao_iniciado = result.method.queue
        channel.queue_bind(exchange='leilao_iniciado', queue=queue_leilao_iniciado)
        
        channel.queue_bind(exchange='leilao', queue='lance_realizado', routing_key='lance_realizado')
        channel.queue_bind(exchange='leilao', queue='leilao_finalizado', routing_key='leilao_finalizado')
        return queue_leilao_iniciado
    except Exception as e:
        print(f"Erro ao conectar: {e}")
        return None

def carregar_chave_publica(user_id):
    try:
        with open(f"keys/client_{user_id}_public.pem", "rb") as f:
            public_key = RSA.import_key(f.read())
        return public_key
    except Exception:
        return None

def verificar_assinatura(lance_data, signature, user_id):
    try:
        public_key = carregar_chave_publica(user_id)
        if not public_key:
            return False

        message = json.dumps(lance_data, sort_keys=True).encode()
        hash_obj = SHA256.new(message)

        signature_bytes = base64.b64decode(signature)

        pkcs1_15.new(public_key).verify(hash_obj, signature_bytes)
        return True
    except Exception:
        return False

def callback_leilao_iniciado(ch, method, properties, body):
    try:
        leilao = json.loads(body)
        leilao_id = leilao.get('id')
        
        if leilao_id:
            leiloes_ativos[leilao_id] = leilao
            lances_por_leilao[leilao_id] = []
            print(f"Leilão {leilao_id} registrado como ativo")
            
    except Exception as e:
        print(f"Erro ao processar leilão iniciado: {e}")

def callback_lance_realizado(ch, method, properties, body):
    try:
        dados = json.loads(body)

        signature = dados.pop('assinatura', None)
        
        lance_data = dados
        
        if not lance_data or not signature:
            print("Lance inválido: dados ou assinatura faltando")
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return
        
        leilao_id = lance_data.get('leilao_id')
        user_id = lance_data.get('user_id')
        valor = lance_data.get('valor')
                
        if leilao_id not in leiloes_ativos:
            print(f"Lance rejeitado: leilão {leilao_id} não está ativo")
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return
        
        if not verificar_assinatura(lance_data, signature, user_id):
            print(f"Lance rejeitado: assinatura inválida para usuário {user_id}")
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return
        
        lances_leilao = lances_por_leilao.get(leilao_id, [])
        if lances_leilao and valor <= lances_leilao[-1]['valor']:
            print(f"Lance rejeitado: valor {valor} não é maior que o último lance")
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return
        
        lance_validado = {
            'leilao_id': leilao_id,
            'user_id': user_id,
            'valor': valor,
            'timestamp': datetime.now().isoformat()
        }
        
        lances_por_leilao[leilao_id].append(lance_validado)
        
        channel.basic_publish(
            exchange='leilao',
            routing_key='lance_validado',
            body=json.dumps(lance_validado)
        )        
    except Exception as e:
        print(f"Erro ao processar lance: {e}")
    
    ch.basic_ack(delivery_tag=method.delivery_tag)

def callback_leilao_finalizado(ch, method, properties, body):
    try:
        leilao = json.loads(body)
        leilao_id = leilao.get('id')
        
        if leilao_id in leiloes_ativos:
            lances = lances_por_leilao.get(leilao_id, [])
            
            if lances:
                vencedor = lances[-1]
                
                evento_vencedor = {
                    'leilao_id': leilao_id,
                    'vencedor_id': vencedor['user_id'],
                    'valor_final': vencedor['valor'],
                    'timestamp': datetime.now().isoformat()
                }
                
                channel.basic_publish(
                    exchange='leilao',
                    routing_key='leilao_vencedor',
                    body=json.dumps(evento_vencedor)
                )
                
                print(f"Leilão {leilao_id} finalizado - Vencedor: {vencedor['user_id']} com valor {vencedor['valor']}")
            else:
                print(f"Leilão {leilao_id} finalizado sem lances")
            
            del leiloes_ativos[leilao_id]
            
    except Exception as e:
        print(f"Erro ao processar leilão finalizado: {e}")
    
    ch.basic_ack(delivery_tag=method.delivery_tag)

def iniciar_consumidores(queue_leilao_iniciado):
    channel.basic_consume(
        queue=queue_leilao_iniciado,
        on_message_callback=callback_leilao_iniciado,
        auto_ack=True
    )
    
    channel.basic_consume(
        queue='lance_realizado',
        on_message_callback=callback_lance_realizado,
        auto_ack=False
    )
    
    channel.basic_consume(
        queue='leilao_finalizado',
        on_message_callback=callback_leilao_finalizado,
        auto_ack=False
    )

def main():
    global running
    
    queue_leilao_iniciado = conectar_rabbitmq()
    if not queue_leilao_iniciado:
        print("Erro ao conectar ao RabbitMQ")
        return
    
    iniciar_consumidores(queue_leilao_iniciado)
    
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