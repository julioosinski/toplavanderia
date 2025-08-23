-- Fix auth security settings
-- 1. Set OTP expiry to recommended threshold (24 hours = 86400 seconds)
UPDATE auth.config 
SET raw_app_meta_data = jsonb_set(
  COALESCE(raw_app_meta_data, '{}'),
  '{otp_exp}',
  '86400'
)
WHERE raw_app_meta_data IS NOT NULL OR raw_app_meta_data IS NULL;