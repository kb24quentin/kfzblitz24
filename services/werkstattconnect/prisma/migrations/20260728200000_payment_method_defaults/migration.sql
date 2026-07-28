ALTER TABLE "Workshop" ADD COLUMN "invoicePaymentTermDays" INT NOT NULL DEFAULT 14;
ALTER TABLE "Workshop" ADD COLUMN "quoteValidityDays"      INT NOT NULL DEFAULT 14;

ALTER TABLE "Invoice" ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'bank_transfer';
