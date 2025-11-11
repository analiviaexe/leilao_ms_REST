# leilao_ms_REST

Aplicação de exemplo de leilões com um gateway API (Node/Express) e um frontend (React + Vite).

Pré-requisitos
- Node.js (>= 16) e npm

Instalar dependências
- Instalar dependências da API e iniciar:

	cd api; npm install; npm start

- Instalar dependências do frontend e iniciar (em outro terminal):

	cd frontend; npm install; npm run dev

Acessar
- API Gateway: http://localhost:3000
- Frontend (Vite): normalmente em http://localhost:5173

Notas
- O gateway expõe endpoints em português, por exemplo `/leiloes/ativos`, `/leiloes`, `/lances` e `/leiloes/interesse/:usuarioId/:leilaoId`.
- As notificações em tempo real usam Server-Sent Events (SSE); para manter uma inscrição ativa, use um cliente que mantenha a conexão aberta (por exemplo, `EventSource` no navegador ou `curl -N`).

