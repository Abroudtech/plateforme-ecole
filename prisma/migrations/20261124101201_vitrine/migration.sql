-- CreateEnum
CREATE TYPE "SitePhotoKind" AS ENUM ('LOGO', 'HERO', 'GALLERY');

-- CreateTable
CREATE TABLE "SchoolSite" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "domain" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'encre',
    "heroTitleFr" TEXT,
    "heroTitleAr" TEXT,
    "heroTextFr" TEXT,
    "heroTextAr" TEXT,
    "aboutFr" TEXT,
    "aboutAr" TEXT,
    "highlights" JSONB NOT NULL DEFAULT '[]',
    "cycleTexts" JSONB NOT NULL DEFAULT '{}',
    "admissionsFr" TEXT,
    "admissionsAr" TEXT,
    "hoursFr" TEXT,
    "hoursAr" TEXT,
    "whatsapp" TEXT,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "mapUrl" TEXT,
    "inquiryForm" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitePhoto" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "kind" "SitePhotoKind" NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "captionFr" TEXT,
    "captionAr" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SitePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteInquiry" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "parentName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "childLevel" TEXT,
    "message" TEXT NOT NULL,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchoolSite_schoolId_key" ON "SchoolSite"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolSite_domain_key" ON "SchoolSite"("domain");

-- CreateIndex
CREATE INDEX "SitePhoto_schoolId_kind_position_idx" ON "SitePhoto"("schoolId", "kind", "position");

-- CreateIndex
CREATE INDEX "SiteInquiry_schoolId_createdAt_idx" ON "SiteInquiry"("schoolId", "createdAt");

-- AddForeignKey
ALTER TABLE "SchoolSite" ADD CONSTRAINT "SchoolSite_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePhoto" ADD CONSTRAINT "SitePhoto_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteInquiry" ADD CONSTRAINT "SiteInquiry_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
