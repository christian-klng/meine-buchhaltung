-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('draft', 'unchecked', 'awaiting_fx', 'checked');

-- CreateEnum
CREATE TYPE "VoucherType" AS ENUM ('purchaseinvoice', 'purchasecreditnote', 'salesinvoice', 'salescreditnote');

-- CreateEnum
CREATE TYPE "TaxType" AS ENUM ('vatfree', 'reverse_charge');

-- CreateEnum
CREATE TYPE "ReverseChargeFlag" AS ENUM ('ja', 'nein', 'pruefen');

-- CreateEnum
CREATE TYPE "SplitType" AS ENUM ('none', 'split_70_30');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('matched', 'suggested', 'manual');

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lexwareCategoryId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'outgo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "countryCode" TEXT,
    "role" TEXT NOT NULL DEFAULT 'vendor',
    "lexwareId" TEXT,
    "matchDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "matchIban" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "matchStrings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorRule" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "defaultCategoryId" TEXT,
    "splitType" "SplitType" NOT NULL DEFAULT 'none',
    "businessPercent" INTEGER,
    "businessCategoryId" TEXT,
    "privatCategoryId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "reverseCharge" "ReverseChargeFlag" NOT NULL DEFAULT 'nein',
    "reverseChargeVatRate" INTEGER NOT NULL DEFAULT 19,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voucher" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "contactId" TEXT,
    "voucherNumber" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "originalAmountCents" INTEGER,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "status" "VoucherStatus" NOT NULL DEFAULT 'draft',
    "type" "VoucherType" NOT NULL DEFAULT 'purchaseinvoice',
    "taxType" "TaxType" NOT NULL DEFAULT 'vatfree',
    "remark" TEXT,
    "paidPrivately" BOOLEAN NOT NULL DEFAULT false,
    "reverseCharge" "ReverseChargeFlag" NOT NULL DEFAULT 'nein',
    "reverseChargeBaseEurCents" INTEGER,
    "reverseChargeVatRate" INTEGER,
    "reverseChargeVatCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoucherItem" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "taxRatePercent" INTEGER NOT NULL DEFAULT 0,
    "taxAmountCents" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,

    CONSTRAINT "VoucherItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoucherFile" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "originalName" TEXT,
    "mimeType" TEXT,
    "sha256" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "extractedText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoucherFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankStatement" (
    "id" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "account" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "fileName" TEXT,
    "rawHash" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankTransaction" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "counterparty" TEXT,
    "purpose" TEXT,
    "rawRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationLink" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "bankTransactionId" TEXT NOT NULL,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'suggested',
    "confidence" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_lexwareCategoryId_key" ON "Category"("lexwareCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_name_key" ON "Contact"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_lexwareId_key" ON "Contact"("lexwareId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorRule_contactId_key" ON "VendorRule"("contactId");

-- CreateIndex
CREATE INDEX "Voucher_status_idx" ON "Voucher"("status");

-- CreateIndex
CREATE INDEX "Voucher_contactId_idx" ON "Voucher"("contactId");

-- CreateIndex
CREATE INDEX "VoucherFile_sha256_idx" ON "VoucherFile"("sha256");

-- CreateIndex
CREATE INDEX "BankTransaction_date_idx" ON "BankTransaction"("date");

-- CreateIndex
CREATE INDEX "BankTransaction_amountCents_idx" ON "BankTransaction"("amountCents");

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationLink_voucherId_bankTransactionId_key" ON "ReconciliationLink"("voucherId", "bankTransactionId");

-- CreateIndex
CREATE INDEX "AuditLog_voucherId_idx" ON "AuditLog"("voucherId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "VendorRule" ADD CONSTRAINT "VendorRule_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorRule" ADD CONSTRAINT "VendorRule_defaultCategoryId_fkey" FOREIGN KEY ("defaultCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorRule" ADD CONSTRAINT "VendorRule_businessCategoryId_fkey" FOREIGN KEY ("businessCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorRule" ADD CONSTRAINT "VendorRule_privatCategoryId_fkey" FOREIGN KEY ("privatCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherItem" ADD CONSTRAINT "VoucherItem_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherItem" ADD CONSTRAINT "VoucherItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherFile" ADD CONSTRAINT "VoucherFile_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "BankStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationLink" ADD CONSTRAINT "ReconciliationLink_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationLink" ADD CONSTRAINT "ReconciliationLink_bankTransactionId_fkey" FOREIGN KEY ("bankTransactionId") REFERENCES "BankTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
