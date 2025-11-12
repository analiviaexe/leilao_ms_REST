const amqp = require('amqplib');
const sse = require('./sse_interests');

const RABBITMQ_URL = "amqp://localhost";

async function conectarRabbitMQ() {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();
        
        await channel.assertExchange('leilao', 'direct', { durable: false });
        
        // Consumir lance_validado
        const queueValidado = await channel.assertQueue('', { exclusive: true });
        await channel.bindQueue(queueValidado.queue, 'leilao', 'lance_validado');
        
        channel.consume(queueValidado.queue, (msg) => {
            if (msg) {
                try {
                    const lance = JSON.parse(msg.content.toString());
                    console.log('lance_validado recebido:', lance);
                    
                    // Notificar clientes interessados no leilão
                    sse.notifyLeilaoEvent(lance.leilao_id, 'novo_lance', {
                        usuarioId: lance.user_id,
                        valor: lance.valor,
                        timestamp: lance.timestamp
                    });
                } catch (e) {
                    console.error('Erro ao processar lance_validado:', e);
                }
                channel.ack(msg);
            }
        }, { noAck: false });
        
        // Consumir lance_invalidado
        const queueInvalidado = await channel.assertQueue('', { exclusive: true });
        await channel.bindQueue(queueInvalidado.queue, 'leilao', 'lance_invalidado');
        
        channel.consume(queueInvalidado.queue, (msg) => {
            if (msg) {
                try {
                    const lance = JSON.parse(msg.content.toString());
                    console.log('lance_invalidado recebido:', lance);
                    
                    // Notificar apenas o usuário que deu o lance inválido
                    sse.sendSse(lance.user_id, 'lance_invalido', {
                        leilaoId: lance.leilao_id,
                        valor: lance.valor,
                        motivo: lance.motivo,
                        timestamp: lance.timestamp
                    });
                } catch (e) {
                    console.error('Erro ao processar lance_invalidado:', e);
                }
                channel.ack(msg);
            }
        }, { noAck: false });
        
        // Consumir leilao_vencedor
        const queueVencedor = await channel.assertQueue('', { exclusive: true });
        await channel.bindQueue(queueVencedor.queue, 'leilao', 'leilao_vencedor');
        
        channel.consume(queueVencedor.queue, (msg) => {
            if (msg) {
                try {
                    const evento = JSON.parse(msg.content.toString());
                    console.log('leilao_vencedor recebido:', evento);
                    
                    // Notificar todos os clientes interessados no leilão
                    sse.notifyLeilaoEvent(evento.leilao_id, 'leilao_vencedor', {
                        vencedorId: evento.vencedor_id,
                        valorFinal: evento.valor_final,
                        timestamp: evento.timestamp
                    });
                } catch (e) {
                    console.error('Erro ao processar leilao_vencedor:', e);
                }
                channel.ack(msg);
            }
        }, { noAck: false });
        
        // Consumir link_pagamento (se MS Pagamento publicar)
        const queueLinkPagamento = await channel.assertQueue('', { exclusive: true });
        await channel.bindQueue(queueLinkPagamento.queue, 'leilao', 'link_pagamento');
        
        channel.consume(queueLinkPagamento.queue, (msg) => {
            if (msg) {
                try {
                    const evento = JSON.parse(msg.content.toString());
                    console.log('link_pagamento recebido:', evento);
                    
                    // Notificar apenas o vencedor
                    sse.sendSse(evento.vencedor_id || evento.user_id, 'link_pagamento', {
                        leilaoId: evento.leilao_id,
                        link: evento.link,
                        timestamp: evento.timestamp
                    });
                } catch (e) {
                    console.error('Erro ao processar link_pagamento:', e);
                }
                channel.ack(msg);
            }
        }, { noAck: false });
        
        // Consumir status_pagamento
        const queueStatusPagamento = await channel.assertQueue('', { exclusive: true });
        await channel.bindQueue(queueStatusPagamento.queue, 'leilao', 'status_pagamento');
        
        channel.consume(queueStatusPagamento.queue, (msg) => {
            if (msg) {
                try {
                    const evento = JSON.parse(msg.content.toString());
                    console.log('status_pagamento recebido:', evento);
                    
                    // notifica o cliente específico
                    sse.sendSse(evento.user_id || evento.vencedor_id, 'status_pagamento', {
                        leilaoId: evento.leilao_id,
                        status: evento.status,
                        timestamp: evento.timestamp
                    });
                } catch (e) {
                    console.error('Erro ao processar status_pagamento:', e);
                }
                channel.ack(msg);
            }
        }, { noAck: false });
                
        connection.on('error', (err) => {
            console.error('Erro na conexão:', err.message);
        });
        
        connection.on('close', () => {
            setTimeout(conectarRabbitMQ, 5000);
        });
        
    } catch (error) {
        console.error(' Erro ao conectar:', error.message);
        setTimeout(conectarRabbitMQ, 5000);
    }
}

module.exports = { conectarRabbitMQ };
