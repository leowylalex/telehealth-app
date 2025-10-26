-- CreateEnum
CREATE TYPE "ErrorSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ErrorCategory" AS ENUM ('COMPILATION', 'DEPENDENCY', 'SYNTAX', 'LOGIC', 'INFRASTRUCTURE', 'USER_INPUT');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'AUTO_FIXED');

-- AlterEnum
ALTER TYPE "MessageType" ADD VALUE 'APPROVAL_REQUEST';

-- CreateTable
CREATE TABLE "ErrorLog" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "category" "ErrorCategory" NOT NULL,
    "severity" "ErrorSeverity" NOT NULL,
    "errorData" JSONB NOT NULL,
    "diagnostic" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposedFix" (
    "id" TEXT NOT NULL,
    "errorLogId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "fixData" JSONB NOT NULL,
    "reasoning" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposedFix_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ErrorLog_messageId_key" ON "ErrorLog"("messageId");

-- AddForeignKey
ALTER TABLE "ErrorLog" ADD CONSTRAINT "ErrorLog_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposedFix" ADD CONSTRAINT "ProposedFix_errorLogId_fkey" FOREIGN KEY ("errorLogId") REFERENCES "ErrorLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
