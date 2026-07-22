const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.office365.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // Outlook/M365 uses STARTTLS on 587, not implicit TLS
  requireTLS: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendVisitRequestNotification(request) {
  const to = process.env.NOTIFY_TO || process.env.SMTP_USER;
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  await transporter.sendMail({
    from,
    to,
    replyTo: request.email,
    subject: `New visit request: ${request.name} (${request.visitType || 'unspecified'})`,
    text: [
      `Name: ${request.name}`,
      `Email: ${request.email}`,
      `Affiliation: ${request.affiliation || '-'}`,
      `Visit type: ${request.visitType || '-'}`,
      `Preferred date: ${request.preferredDate || '-'}`,
      '',
      'Message:',
      request.message || '(none)',
    ].join('\n'),
  });
}

module.exports = { transporter, sendVisitRequestNotification };
