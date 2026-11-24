-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "WatchDecision" AS ENUM ('ALLOWED', 'BLOCKED', 'NEEDS_APPROVAL');

-- CreateEnum
CREATE TYPE "EventKind" AS ENUM ('CHECK', 'WATCH', 'BYPASS_ATTEMPT');

-- CreateTable
CREATE TABLE "Parent" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "fcmTokens" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Parent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Child" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "birthYear" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Child_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "pairingCode" TEXT,
    "pairingExpiresAt" TIMESTAMP(3),
    "deviceTokenHash" TEXT,
    "fcmToken" TEXT,
    "isDeviceOwner" BOOLEAN NOT NULL DEFAULT false,
    "pairedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleSet" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "maxAgeRating" INTEGER NOT NULL DEFAULT 7,
    "blockedTopics" TEXT[] DEFAULT ARRAY['violence', 'scary', 'sexual', 'drugs', 'gambling', 'dangerous_challenges']::TEXT[],
    "blockedKeywords" TEXT[],
    "allowedChannels" TEXT[],
    "blockedChannels" TEXT[],
    "allowlistOnly" BOOLEAN NOT NULL DEFAULT false,
    "listOnly" BOOLEAN NOT NULL DEFAULT false,
    "dailyMinutes" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuleSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoClassification" (
    "videoId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topics" TEXT[],
    "ageRating" INTEGER NOT NULL,
    "language" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "modelVer" TEXT NOT NULL,
    "classifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoClassification_pkey" PRIMARY KEY ("videoId")
);

-- CreateTable
CREATE TABLE "VideoOverride" (
    "childId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoOverride_pkey" PRIMARY KEY ("childId","videoId")
);

-- CreateTable
CREATE TABLE "VideoList" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sourcePlaylistId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoListItem" (
    "listId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "thumbnail" TEXT,
    "position" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoListItem_pkey" PRIMARY KEY ("listId","videoId")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "thumbnail" TEXT,
    "reason" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchEvent" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "kind" "EventKind" NOT NULL DEFAULT 'CHECK',
    "videoId" TEXT,
    "decision" "WatchDecision",
    "reason" TEXT,
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Parent_email_key" ON "Parent"("email");

-- CreateIndex
CREATE INDEX "Child_parentId_idx" ON "Child"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Device_pairingCode_key" ON "Device"("pairingCode");

-- CreateIndex
CREATE UNIQUE INDEX "Device_deviceTokenHash_key" ON "Device"("deviceTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "RuleSet_childId_key" ON "RuleSet"("childId");

-- CreateIndex
CREATE INDEX "VideoList_childId_isActive_idx" ON "VideoList"("childId", "isActive");

-- CreateIndex
CREATE INDEX "VideoListItem_videoId_idx" ON "VideoListItem"("videoId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_childId_status_idx" ON "ApprovalRequest"("childId", "status");

-- CreateIndex
CREATE INDEX "WatchEvent_childId_createdAt_idx" ON "WatchEvent"("childId", "createdAt");

-- AddForeignKey
ALTER TABLE "Child" ADD CONSTRAINT "Child_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleSet" ADD CONSTRAINT "RuleSet_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoOverride" ADD CONSTRAINT "VideoOverride_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoList" ADD CONSTRAINT "VideoList_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoListItem" ADD CONSTRAINT "VideoListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "VideoList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchEvent" ADD CONSTRAINT "WatchEvent_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

