/**
 * Creates 4 Ethereal (https://ethereal.email) test SMTP accounts and upserts them
 * as active Senders. Run with: npm run seed:senders --workspace backend
 */
import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import 'dotenv/config';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be set to a 32-byte string in backend/.env');
}

function encrypt(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY!), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

const SENDER_COUNT = 4;

async function main() {
  const prisma = new PrismaClient();

  // Ethereal's createTestAccount() is meant to mint a fresh disposable inbox
  // per call, but in some networks it now returns the same account for every
  // call from the same IP (verified: 3 calls, 3s apart, identical account).
  // We still want SENDER_COUNT distinct Sender rows so round-robin / per-sender
  // rate limiting has something to round-robin over, so: try to get a fresh
  // account each time, and fall back to reusing the last successful account
  // (with a distinct display name/email) rather than failing the whole seed.
  const accounts: Awaited<ReturnType<typeof nodemailer.createTestAccount>>[] = [];
  for (let i = 0; i < SENDER_COUNT; i++) {
    const account = await nodemailer.createTestAccount();
    accounts.push(account);
  }

  const distinctUsers = new Set(accounts.map((a) => a.user));
  if (distinctUsers.size < SENDER_COUNT) {
    console.warn(
      `\nWarning: Ethereal returned only ${distinctUsers.size} distinct test account(s) for ` +
        `${SENDER_COUNT} requests (this is an Ethereal/network limitation, not a bug here). ` +
        `Creating ${SENDER_COUNT} Sender rows that share the underlying SMTP credentials so ` +
        `round-robin and per-sender rate limiting still have multiple senders to work with.\n`,
    );
  }

  for (let i = 1; i <= SENDER_COUNT; i++) {
    const account = accounts[i - 1];
    const displayEmail = distinctUsers.size < SENDER_COUNT ? `sender-${i}.${account.user}` : account.user;

    const sender = await prisma.sender.upsert({
      where: { email: displayEmail },
      update: {
        smtpHost: account.smtp.host,
        smtpPort: account.smtp.port,
        smtpUser: account.user,
        smtpPass: encrypt(account.pass),
        active: true,
      },
      create: {
        name: `Sender ${i}`,
        email: displayEmail,
        smtpHost: account.smtp.host,
        smtpPort: account.smtp.port,
        smtpUser: account.user,
        smtpPass: encrypt(account.pass),
        active: true,
      },
    });

    console.log(`Created sender ${sender.name} <${sender.email}> (id=${sender.id})`);
  }

  await prisma.$disconnect();
  console.log(`\nDone. ${SENDER_COUNT} Ethereal senders are ready.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
