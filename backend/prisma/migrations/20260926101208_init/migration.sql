-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "googleId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlackConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "channelId" TEXT,
    "webhookUrl" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "SlackConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sender" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "smtpHost" TEXT NOT NULL,
    "smtpPort" INTEGER NOT NULL,
    "smtpUser" TEXT NOT NULL,
    "smtpPass" TEXT NOT NULL,
    "hourlyLimit" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "delayBetweenMs" INTEGER NOT NULL,
    "hourlyLimit" INTEGER NOT NULL,
    "totalCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Email" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "seq" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "messageId" TEXT,
    "previewUrl" TEXT,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Email_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SlackConnection_userId_key" ON "SlackConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Sender_email_key" ON "Sender"("email");

-- CreateIndex
CREATE INDEX "Campaign_userId_idx" ON "Campaign"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Email_idempotencyKey_key" ON "Email"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Email_userId_status_scheduledAt_idx" ON "Email"("userId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "Email_senderId_status_idx" ON "Email"("senderId", "status");

-- AddForeignKey
ALTER TABLE "SlackConnection" ADD CONSTRAINT "SlackConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Sender"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
