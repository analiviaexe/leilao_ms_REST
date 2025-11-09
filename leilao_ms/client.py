import pika
import json
import base64
import os
from datetime import datetime
from Crypto.PublicKey import RSA
from Crypto.Signature import pkcs1_15
from Crypto.Hash import SHA256
import sys

user_id = None
connection = None
channel = None
running = True
leiloes_ativos = {}
leiloes_interessado = set()
private_key = None
public_key = None
queue_leilao_iniciado = None

def inicializar_chaves():
    global private_key, public_key
    private_key = RSA.generate(2048)
    public_key = private_key.publickey()
    salvar_chave_publica()

def salvar_chave_publica():
    public_pem = public_key.export_key()
    private_pem = private_key.export_key()
    
    if not os.path.exists("keys"):
        os.makedirs("keys")
    
    with open(f"keys/client_{user_id}_public.pem", "wb") as f:
        f.write(public_pem)

def conectar_rabbitmq():
    global connection, channel, queue_leilao_iniciado
    try:
        connection = pika.BlockingConnection(
            pika.ConnectionParameters('localhost')
        )
        channel = connection.channel()
        
        channel.exchange_declare(exchange='leilao_iniciado', exchange_type='fanout')
        channel.exchange_declare(exchange='leilao', exchange_type='direct')
        channel.exchange_declare(exchange='notificacoes_leilao', exchange_type='direct')
        
        result = channel.queue_declare(queue='', exclusive=True)
        queue_leilao_iniciado = result.method.queue
        channel.queue_bind(exchange='leilao_iniciado', queue=queue_leilao_iniciado)
        
        return True
    except Exception:
        return False

def assinar_lance(lance_data):
    message = json.dumps(lance_data, sort_keys=True).encode()
    hash_obj = SHA256.new(message)
    
    signature = pkcs1_15.new(private_key).sign(hash_obj)
    
    return base64.b64encode(signature).decode('utf-8')

def publicar_lance(leilao_id, valor):
    try:
        lance_data = {
            "leilao_id": leilao_id,
            "user_id": user_id,
            "valor": valor,
            "timestamp": datetime.now().isoformat()
        }
        
        assinatura = assinar_lance(lance_data)
        lance_data["assinatura"] = assinatura
        
        channel.basic_publish(
            exchange='leilao',
            routing_key='lance_realizado',
            body=json.dumps(lance_data)
        )
        
        registrar_interesse_leilao(leilao_id)
        
    except Exception as e:
        print(f"Erro ao publicar lance: {e}")

def registrar_interesse_leilao(leilao_id):
    if leilao_id not in leiloes_interessado:
        leiloes_interessado.add(leilao_id)

        try:
            channel.exchange_declare(exchange='notificacoes_leilao', exchange_type='direct')
            
            result = channel.queue_declare(queue='', exclusive=True)
            fila_client_leilao = result.method.queue
            
            channel.queue_bind(
                exchange='notificacoes_leilao',
                queue=fila_client_leilao,
                routing_key=f'leilao_{leilao_id}'
            )
            
            channel.basic_consume(
                queue=fila_client_leilao,
                on_message_callback=callback_notificacao_leilao_especifica,
                auto_ack=True
            )
            print(f"Acompanhando leilão de número {leilao_id}")
        except Exception as e:
            print(f"Erro ao conectar às notificações do leilão {leilao_id}: {e}")

def callback_leilao_iniciado(ch, method, properties, body):
    try:
        evento = json.loads(body)
        leilao_id = evento['id']
        leiloes_ativos[leilao_id] = evento        
    except Exception as e:
        pass

def callback_notificacao_leilao_especifica(ch, method, properties, body):
    try:
        notificacao = json.loads(body)
        leilao_id = notificacao.get('leilao_id')
        
        if leilao_id in leiloes_interessado:
            if notificacao['tipo'] == 'novo_lance':
                print(f"\n Novo lance no leilão {leilao_id}: R$ {notificacao['valor']} por {notificacao['user_id']}")
            elif notificacao['tipo'] == 'leilao_vencedor':
                print(f"\n Leilão {leilao_id} finalizado! Vencedor: {notificacao['vencedor_id']} com R$ {notificacao['valor_final']}")
                if leilao_id in leiloes_ativos:
                    del leiloes_ativos[leilao_id]
                
    except Exception as e:
        pass

def interface_usuario():
    print(f"\n=== Cliente {user_id} ===")
    
    while running:
        try:            
            print("\nComandos:")
            print("1. Listar leilões ativos")
            if leiloes_interessado:
                print("2. Acompanhar meus leilões")
                print("3. Sair")
            else:
                print("2. Sair")
            comando = input(f"\nCliente {user_id}> ").strip()
            
            if comando == "1":
                connection.process_data_events(time_limit=0.1)
                listar_e_dar_lance()
            elif comando == "2" and leiloes_interessado:
                acompanhar_meus_leiloes()
            elif (comando == "2" and not leiloes_interessado) or comando == "3":
                parar()
                break
            else:
                print("Comando inválido")
                
        except KeyboardInterrupt:
            parar()
            break
        except Exception as e:
            print(f"Erro: {e}")

def acompanhar_meus_leiloes():
    if not leiloes_interessado:
        print("Você não está acompanhando nenhum leilão ainda.")
        return
    
    print(f"\n Acompanhando leilões: {', '.join(map(str, leiloes_interessado))}")
    print("Aguardando notificações... (CTRL+C para voltar ao menu)")
    
    try:
        channel.start_consuming()
        
    except KeyboardInterrupt:
        try:
            channel.stop_consuming()
        except:
            pass
        print("\nVoltando ao menu...")

def listar_e_dar_lance():
    if not leiloes_ativos:
        print("Nenhum leilão ativo")
        return
        
    print("\nLeilões ativos:")
    for leilao_id, dados in leiloes_ativos.items():
        print(f"{leilao_id}. {dados['descricao']}")
        print(f"   Início: {dados['inicio']} | Fim: {dados['fim']}")
    
    try:
        print("\nPara dar um lance:")
        leilao_escolhido = input("Número do leilão: ").strip()
        if not leilao_escolhido:
            return
            
        leilao_id = int(leilao_escolhido)
        if leilao_id not in leiloes_ativos:
            print("Leilão não encontrado")
            return
            
        valor = input("Valor do lance: R$ ").strip()
        if not valor:
            return
            
        valor_float = float(valor)
        publicar_lance(leilao_id, valor_float)
        
    except ValueError:
        print("Valor inválido")
    except Exception as e:
        print(f"Erro: {e}")

def parar():
    global running
    running = False
    if connection and not connection.is_closed:
        connection.close()
    
    try:
        public_key_file = f"keys/client_{user_id}_public.pem"
        private_key_file = f"keys/client_{user_id}_private.pem"
        
        if os.path.exists(public_key_file):
            os.remove(public_key_file)
        if os.path.exists(private_key_file):
            os.remove(private_key_file)
    except Exception as e:
        print(f"Erro ao remover chaves: {e}")

def main():
    global user_id      
    user_id = sys.argv[1]
    
    inicializar_chaves()
    
    if not conectar_rabbitmq():
        print("Erro ao conectar ao RabbitMQ")
        return
        
    channel.basic_consume(
        queue=queue_leilao_iniciado,
        on_message_callback=callback_leilao_iniciado,
        auto_ack=True
    )
    interface_usuario()

if __name__ == "__main__":
    main()
