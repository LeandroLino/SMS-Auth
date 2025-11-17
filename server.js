const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');

// 1. Carrega as variáveis do arquivo .env para 'process.env'
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

// --- Configuração ---
// 2. Lê as chaves diretamente do 'process.env'
const ACCOUNT_SID = process.env.ACCOUNT_SID;
const AUTH_TOKEN = process.env.AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// Validação simples para garantir que as chaves foram carregadas
if (!ACCOUNT_SID || !AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
	console.error(
		'Erro: Variáveis de ambiente do Twilio não estão configuradas.'
	);
	console.error('Verifique seu arquivo .env');
	process.exit(1); // Encerra o app se as chaves não existirem
}

const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

// --- "Banco de Dados" Temporário ---
// Em produção, use Redis!
const activeCodes = {};

/**
 * Gera um código OTP de 6 dígitos
 */
function generateOTP() {
	return Math.floor(100000 + Math.random() * 900000).toString();
}

// --- Endpoint 1: Enviar o SMS de verificação ---
app.post('/enviar-sms', async (req, res) => {
	const { telefone } = req.body;

	if (!telefone) {
		return res.status(400).send({ error: 'Número de telefone é obrigatório.' });
	}

	const otp = generateOTP();
	const expires = Date.now() + 5 * 60 * 1000; // 5 minutos

	activeCodes[telefone] = { code: otp, expires: expires };
	console.log(`Código gerado para ${telefone}: ${otp}`);

	try {
		await client.messages.create({
			body: `Seu código de verificação é: ${otp}`,
			from: TWILIO_PHONE_NUMBER,
			to: telefone,
		});

		res
			.status(200)
			.send({ success: true, message: 'SMS de verificação enviado.' });
	} catch (error) {
		console.error('Erro ao enviar SMS:', error);
		res.status(500).send({ error: 'Falha ao enviar SMS.' });
	}
});

// --- Endpoint 2: Verificar o código digitado ---
app.post('/verificar-codigo', (req, res) => {
	const { telefone, codigo } = req.body;

	if (!telefone || !codigo) {
		return res
			.status(400)
			.send({ error: 'Telefone e código são obrigatórios.' });
	}

	const storedData = activeCodes[telefone];

	if (!storedData) {
		return res
			.status(404)
			.send({ error: 'Nenhum código solicitado para este número.' });
	}

	if (Date.now() > storedData.expires) {
		delete activeCodes[telefone];
		return res
			.status(400)
			.send({ error: 'Código expirado. Solicite um novo.' });
	}

	if (storedData.code === codigo) {
		delete activeCodes[telefone];
		res
			.status(200)
			.send({ success: true, message: 'Número verificado com sucesso!' });
	} else {
		res.status(400).send({ error: 'Código inválido.' });
	}
});

// --- Iniciar o Servidor ---
const PORT = process.env.PORT || 3000; // Permite que o .env defina a porta
app.listen(PORT, () => {
	console.log(`Servidor rodando na porta ${PORT}`);
});
