/**
 * server.js  (OPÇÃO C - Completo)
 *
 * Funcionalidades:
 * - Recebe POST /api/book com dados do formulário
 * - Valida e grava no SQLite
 * - Gera payload PIX simples + QR Code (PNG)
 * - Gera PDF com dados do agendamento e QR code (PDFKit)
 * - Envia e-mail ao cliente + cópia administrativa com PDF anexo (Nodemailer)
 *
 * Requisitos (npm):
 *   npm i express cors dotenv sqlite3 body-parser nodemailer pdfkit qrcode
 *
 * Variáveis de ambiente (.env) esperadas:
 *   PORT (ex: 3000)
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM
 *   PIX_KEY, PIX_DESCRIPTION, PIX_VALUE_PER_PERSON
 *   DB_URL (ex: ./sqlite.db)
 *
 * Observações:
 * - O "PIX" gerado aqui é um payload ilustrativo (string) que será colocado no QR code.
 *   Para integração real de cobrança/pix automático (com confirmação de pagamento),
 *   é preciso integrar com uma API de pagamentos (ex: PSP / Banco / API do PagBank ou do seu banco).
 * - SMTP_PASS: use a senha de app do Gmail (se estiver usando Gmail).
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const DB_FILE = process.env.DB_URL || './sqlite.db';
const PIX_KEY = process.env.PIX_KEY || 'SUA_CHAVE_PIX';
const PIX_DESCRIPTION = process.env.PIX_DESCRIPTION || 'Agendamento MoNa';
const PIX_VALUE_PER_PERSON = parseFloat(process.env.PIX_VALUE_PER_PERSON || '5.00');

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER;

/* ---------------------------
   Inicializa DB (SQLite)
   --------------------------- */
const db = new sqlite3.Database(DB_FILE);
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT,
      email TEXT,
      celular TEXT,
      atividade TEXT,
      data_hora TEXT,
      outros_visitantes INTEGER,
      visitantes_json TEXT,
      total_valor REAL,
      pago INTEGER DEFAULT 0,
      pix_key TEXT,
      created_at TEXT
    )
  `);
});

/* ---------------------------
   Nodemailer transporter
   --------------------------- */
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // true p/ 465
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS
  }
});

/* Função auxiliar: cria payload PIX "simples" (texto).
   Para uso real, implemente o EMV ou a API do PSP. */
function createPixPayload(key, amount, txid = '', description = '') {
  // Payload simples legível para o usuário + QR will encode this string.
  // Ex: PIX|chave=...|valor=...|txid=...|desc=...
  return `PIX|chave=${key}|valor=${amount.toFixed(2)}|txid=${txid}|desc=${description}`;
}

/* Gera PDF buffer (PDFKit) com os dados do agendamento e QR code */
async function generatePdfBuffer(booking, qrBuffer) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const buffers = [];
      doc.on('data', (m) => buffers.push(m));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Cabeçalho
      doc.fontSize(18).text('Comprovante de Agendamento', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(12).fillColor('#333');
      doc.text(`Nome: ${booking.nome}`);
      doc.text(`E-mail: ${booking.email}`);
      doc.text(`Celular: ${booking.celular}`);
      doc.text(`Atividade: ${booking.atividade}`);
      doc.text(`Data / Hora: ${booking.data_hora}`);
      doc.text(`Outros visitantes: ${booking.outros_visitantes}`);
      doc.text(`Valor total: R$ ${booking.total_valor.toFixed(2)}`);
      doc.moveDown();

      // QR code
      doc.fontSize(11).text('PIX - Pague com QR Code abaixo:', { underline: true });
      doc.moveDown(0.2);

      // Insert QR image centered
      const qrImgY = doc.y;
      doc.image(qrBuffer, { fit: [170, 170], align: 'center', valign: 'center' });
      doc.moveDown(10);

      // Observações
      doc.fontSize(10).fillColor('#555');
      doc.text('Ao concluir o pagamento, envie o comprovante para o e-mail ou aguarde a confirmação automática (se disponível).', {
        align: 'left'
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/* endpoint: testa servidor */
app.get('/ping', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

/**
 * POST /api/book
 * Espera receber JSON (ou form-urlencoded) com os campos:
 * - nome, email, celular, atividade, data_hora (string), outros_visitantes (number), visitantes (array opcional)
 *
 * Retorna:
 * { ok: true, id, payment: { pixKey, pixAmount, pixPayload } }
 */
app.post('/api/book', async (req, res) => {
  try {
    const body = req.body || {};
    const nome = (body.nome || body.Nome || '').trim();
    const email = (body.email || body.Email || '').trim();
    const celular = (body.celular || body.Celular || '').trim();
    const atividade = (body.atividade || body.Atividade || '').trim();
    const data_hora = (body.data_hora || body.DataHorario || '').trim();
    const outros_visitantes = parseInt(body.outros_visitantes ?? body.QtdVisitantes ?? 0, 10) || 0;
    const visitantes = body.visitantes || body.Visitantes || []; // opcional array de objetos
    // validação mínima
    if (!nome || !email || !atividade || !data_hora) {
      return res.status(400).json({ ok: false, error: 'Campos obrigatórios faltando (nome, email, atividade, data_hora).' });
    }

    // calcula total: inclui o titular + outros visitantes
    const totalPersons = 1 + (Number.isFinite(outros_visitantes) ? outros_visitantes : 0);
    const total_valor = Number((PIX_VALUE_PER_PERSON * totalPersons).toFixed(2));

    // gera payload PIX e QR
    const pixPayload = createPixPayload(PIX_KEY, total_valor, '', PIX_DESCRIPTION);
    const qrBuffer = await QRCode.toBuffer(pixPayload, { type: 'png', width: 300 });

    // salva no DB
    const nowIso = new Date().toISOString();
    const visitantesJson = JSON.stringify(visitantes);
    const insertSql = `
      INSERT INTO bookings (nome,email,celular,atividade,data_hora,outros_visitantes,visitantes_json,total_valor,pago,pix_key,created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `;
    const params = [nome, email, celular, atividade, data_hora, outros_visitantes, visitantesJson, total_valor, PIX_KEY, nowIso];

    const runAsync = (sql, p) =>
      new Promise((resolve, reject) => {
        db.run(sql, p, function (err) {
          if (err) return reject(err);
          resolve(this.lastID);
        });
      });

    const bookingId = await runAsync(insertSql, params);

    // cria PDF com dados + QR
    const bookingRecord = {
      id: bookingId,
      nome,
      email,
      celular,
      atividade,
      data_hora,
      outros_visitantes,
      visitantes,
      total_valor
    };
    const pdfBuffer = await generatePdfBuffer(bookingRecord, qrBuffer);

    // prepara e-mail para o cliente (copia administrativa no mesmo envio)
    const mailOptions = {
      from: EMAIL_FROM,
      to: `${email}`, // cliente
      bcc: `${SMTP_USER}`, // copia para sua conta (ou outro admin)
      subject: `Confirmação de Agendamento - ${atividade}`,
      text:
        `Olá ${nome},\n\nRecebemos sua solicitação de agendamento.\n\nAtividade: ${atividade}\nData/Hora: ${data_hora}\nValor a pagar: R$ ${total_valor.toFixed(
          2
        )}\n\nAnexo você encontrará o comprovante com o QR Code PIX para pagamento.\n\nObrigado,\nEquipe MoNa`,
      attachments: [
        {
          filename: `comprovante-agendamento-${bookingId}.pdf`,
          content: pdfBuffer
        },
        {
          filename: `pix-qr-${bookingId}.png`,
          content: qrBuffer
        }
      ]
    };

    // envia email (async)
    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error('Erro ao enviar email:', err);
        // não falhar a API por email — apenas avisar
        return res.status(200).json({
          ok: true,
          id: bookingId,
          warning: 'Reserva salva, mas falha ao enviar e-mail. Verifique logs do servidor.',
          payment: { pixKey: PIX_KEY, pixAmount: total_valor, pixPayload }
        });
      }

      res.status(200).json({
        ok: true,
        id: bookingId,
        message: 'Agendamento salvo e e-mail enviado.',
        mailInfo: info.response || info,
        payment: { pixKey: PIX_KEY, pixAmount: total_valor, pixPayload }
      });
    });
  } catch (err) {
    console.error('Erro /api/book:', err);
    res.status(500).json({ ok: false, error: 'Erro interno do servidor', details: err.message });
  }
});

/* endpoint para confirmar manualmente o pagamento (simples) */
/* Em produção, essa confirmação deveria vir do webhook do PSP/banco após reconciliar o PIX. */
app.post('/api/confirm-payment', async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ ok: false, error: 'bookingId é obrigatório' });

    db.run('UPDATE bookings SET pago = 1 WHERE id = ?', [bookingId], function (err) {
      if (err) return res.status(500).json({ ok: false, error: 'erro ao atualizar DB' });
      return res.json({ ok: true, id: bookingId });
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* lista simples de agendamentos (somente para debug/admin) */
app.get('/admin/bookings', (req, res) => {
  db.all('SELECT * FROM bookings ORDER BY created_at DESC LIMIT 200', [], (err, rows) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true, count: rows.length, rows });
  });
});

/* inicia servidor */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`DB: ${DB_FILE}`);
});
