# Sistema de Leilão com Microserviços

Um sistema de leilão composto por 3 microsserviços, cada um com uma responsabilidade específica. Os microsserviços vão se comunicar exclusivamente via filas de mensagens. O fluxo de dados é orquestrado por eventos através do serviço de mensageria RabbitMQ e do protocolo AMQP que garantem a sincronização entre as diferentes funcionalidades.

### Executar os microserviços (em terminais separados)

```bash
py client.py <nome-do-usuario>
```

Pra rodar os demais MS's (vs-code)
```bash
ctrl + shift + p
tasks: run task
Iniciar todos MS
```

ps: precisa ser necessariamente nessa ordem MS lance > MS notif > MS leilao