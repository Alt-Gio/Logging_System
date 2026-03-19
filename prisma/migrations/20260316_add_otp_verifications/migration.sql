-- CreateTable
CREATE TABLE "otp_verifications" (
    "id" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "contactType" TEXT NOT NULL,
    "otpCode" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "otp_verifications_contact_idx" ON "otp_verifications"("contact");
CREATE INDEX "otp_verifications_expiresAt_idx" ON "otp_verifications"("expiresAt");
