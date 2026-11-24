-- CreateTable
CREATE TABLE "HomeworkDone" (
    "homeworkId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "doneAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeworkDone_pkey" PRIMARY KEY ("homeworkId","studentId")
);

-- CreateTable
CREATE TABLE "ConsentRequest" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "deadline" DATE,
    "audience" "AnnouncementAudience" NOT NULL DEFAULT 'CLASS',
    "gradeLevelId" TEXT,
    "classGroupId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentReply" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accepted" BOOLEAN NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsentRequest_schoolId_createdAt_idx" ON "ConsentRequest"("schoolId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentReply_requestId_studentId_key" ON "ConsentReply"("requestId", "studentId");

-- AddForeignKey
ALTER TABLE "HomeworkDone" ADD CONSTRAINT "HomeworkDone_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkDone" ADD CONSTRAINT "HomeworkDone_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentReply" ADD CONSTRAINT "ConsentReply_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ConsentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentReply" ADD CONSTRAINT "ConsentReply_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
