const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');

require('dotenv').config();

const app = express();
app.use(bodyParser.json());

const ACCOUNT_SID = process.env.ACCOUNT_SID;
const AUTH_TOKEN = process.env.AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

if (!ACCOUNT_SID || !AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
	console.error(
		'Erro: Variáveis de ambiente do Twilio não estão configuradas.'
	);
	process.exit(1);
}

const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

const activeCodes = {};

function generateOTP() {
	return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * @route   POST /sms/send-code
 * @desc    Envia um código de verificação para um número de telefone
 * @body    { "phone": "+5511999998888" }
 */
app.post('/sms/send-code', async (req, res) => {
	const { phone } = req.body;

	if (!phone) {
		return res.status(400).send({ error: 'Phone number is required.' });
	}

	const otp = generateOTP();
	const expires = Date.now() + 5 * 60 * 1000; // 5 minutos

	activeCodes[phone] = { code: otp, expires: expires };
	console.log(`Code generated for ${phone}: ${otp}`);

	try {
		await client.messages.create({
			body: `Seu código de verificação é: ${otp}`,
			from: TWILIO_PHONE_NUMBER,
			to: phone,
		});

		res.status(200).send({ success: true, message: 'Verification SMS sent.' });
	} catch (error) {
		console.error('Error sending SMS:', error);
		res.status(500).send({ error: 'Failed to send SMS.' });
	}
});

/**
 * @route   POST /sms/verify-code
 * @desc    Verifica se o código OTP fornecido é válido
 * @body    { "phone": "+5511999998888", "code": "123456" }
 */
app.post('/sms/verify-code', (req, res) => {
	const { phone, code } = req.body;

	if (!phone || !code) {
		return res.status(400).send({ error: 'Phone and code are required.' });
	}

	const storedData = activeCodes[phone];

	if (!storedData) {
		return res
			.status(404)
			.send({ error: 'No code requested for this number.' });
	}

	if (Date.now() > storedData.expires) {
		delete activeCodes[phone];
		return res.status(400).send({ error: 'Code expired. Request a new one.' });
	}

	if (storedData.code === code) {
		delete activeCodes[phone];
		res
			.status(200)
			.send({ success: true, message: 'Number verified successfully!' });
	} else {
		res.status(400).send({ error: 'Invalid code.' });
	}
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`SMS-Auth server running on port ${PORT}`);
});
