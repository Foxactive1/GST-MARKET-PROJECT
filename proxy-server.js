// proxy-server.js
// Servidor proxy CORS para API do Mercado Livre (fetch nativo)

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors());

app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ error: 'Parâmetro "q" é obrigatório' });
    }

    try {
        const response = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Erro ao acessar API do Mercado Livre:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Proxy rodando em http://localhost:${PORT}`);
    console.log(`📡 Use: http://localhost:${PORT}/api/search?q=SEU_PRODUTO`);
});