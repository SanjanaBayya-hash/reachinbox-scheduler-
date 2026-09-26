import nodemailer, { Transporter } from 'nodemailer';
import type { Sender } from '@prisma/client';
import { decrypt } from '../../utils/crypto';

const transportCache = new Map<string, Transporter>();

export function getTransportForSender(sender: Sender): Transporter {
  const cached = transportCache.get(sender.id);
  if (cached) return cached;

  const transport = nodemailer.createTransport({
    host: sender.smtpHost,
    port: sender.smtpPort,
    secure: false,
    auth: {
      user: sender.smtpUser,
      pass: decrypt(sender.smtpPass),
    },
  });

  transportCache.set(sender.id, transport);
  return transport;
}

export function clearTransportCache(): void {
  transportCache.clear();
}
