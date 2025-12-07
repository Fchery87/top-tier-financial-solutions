-- Migration: Add evidence_requirements column to dispute_letter_templates
-- Date: 2025-12-07
-- Purpose: Fix schema mismatch between db/schema.ts and actual database table

ALTER TABLE "dispute_letter_templates" 
ADD COLUMN IF NOT EXISTS "evidence_requirements" text;
