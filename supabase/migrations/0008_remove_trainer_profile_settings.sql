-- Branding and trainer contact details are no longer configurable or printed.
-- Keep reminder settings and the calendar feed token independent.
alter table public.trainer_settings
  drop column if exists business_name,
  drop column if exists logo_url,
  drop column if exists primary_color,
  drop column if exists secondary_color,
  drop column if exists address,
  drop column if exists phone,
  drop column if exists email;