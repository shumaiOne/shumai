-- CreateTable
CREATE TABLE "rate_limit_state" (
    "key" TEXT NOT NULL,
    "next_permission_time_nanos" BIGINT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_state_pkey" PRIMARY KEY ("key")
);
