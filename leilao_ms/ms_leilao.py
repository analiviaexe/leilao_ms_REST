import pika
import json
import threading
import time
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

connection = None
channel = None
running = True

leiloes = {}

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

@app.route('/leiloes', methods=['POST'])
def criar_leilao():
    try:
        dados = request.json
        leilao_id = dados.get('id')
        
        leilao = {
            "id": leilao_id,
            "nome": dados.get('nome'),
            "descricao": dados.get('descricao'),
            "valorInicial": dados.get('valorInicial'),
            "inicio": dados.get('inicio'),
            "fim": dados.get('fim'),
            "status": "pendente",
            "ultimoLance": None
        }
        
        leiloes[leilao_id] = leilao
        
        print(f"leilao {leilao_id} criado, pendente inicio")
        return jsonify(leilao), 201
    except Exception as e:
        pass

@app.route('/leiloes/ativos', methods=['GET'])
def listar_leiloes_ativos():
    try:
        ativos = [l for l in leiloes.values() if l.get('status') == 'ativo']
        return jsonify(ativos), 200
    except Exception as e:
        pass

def publicar_leilao_iniciado(leilao):
    try:
        evento = {
            "id": leilao["id"],
            "nome": leilao.get("nome"),
            "descricao": leilao["descricao"],
            "valorInicial": leilao.get("valorInicial"),
            "inicio": leilao["inicio"],
            "fim": leilao["fim"]
        }
        channel.basic_publish(
            exchange='leilao_iniciado',
            routing_key='',
            body=json.dumps(evento)
        )
    except Exception as e:
        pass

def publicar_leilao_finalizado(leilao):
    try:
        evento = {
            "id": leilao["id"],
            "descricao": leilao.get("descricao"),
            "timestamp": datetime.now().isoformat(),
            "status": "encerrado"
        }

        channel.basic_publish(
            exchange='leilao',
            routing_key='leilao_finalizado',
            body=json.dumps(evento)
        )
    except Exception as e:
        pass

def verificar_ciclo_vida_leiloes():
    global running
    while running:
        try:
            agora = datetime.now()
            
            for leilao_id, leilao in list(leiloes.items()):
                inicio = datetime.strptime(leilao["inicio"], "%Y-%m-%d %H:%M:%S")
                fim = datetime.strptime(leilao["fim"], "%Y-%m-%d %H:%M:%S")
                
                if leilao["status"] == "pendente" and agora >= inicio and agora < fim:
                    leilao["status"] = "ativo"
                    publicar_leilao_iniciado(leilao)
                    print(f"leilao {leilao_id} iniciado")
                
                elif leilao["status"] == "ativo" and agora >= fim:
                    leilao["status"] = "encerrado"
                    publicar_leilao_finalizado(leilao)
                    print(f"leilao {leilao_id} finalizado")
            
            time.sleep(1)
        except Exception as e:
            print(f"Erro no ciclo de vida: {e}")
            time.sleep(1)

def rabbitmq_thread():
    if not conectar_rabbitmq():
        print("Erro ao conectar ao RabbitMQ")
        return
    
def main():
    # Iniciar thread do RabbitMQ
    threading.Thread(target=rabbitmq_thread, daemon=True).start()
    
    # Iniciar thread do ciclo de vida dos leilões
    threading.Thread(target=verificar_ciclo_vida_leiloes, daemon=True).start()
    
    # Iniciar servidor Flask
    app.run(host='0.0.0.0', port=5000, debug=False)

if __name__ == "__main__":
    main()