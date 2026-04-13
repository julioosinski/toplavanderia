
-- public_machines needs to be security definer (not invoker) so anon can read
-- through the view while machines table blocks direct anon SELECT.
-- The view itself provides security by excluding sensitive columns (total_revenue, total_uses).
ALTER VIEW public.public_machines SET (security_invoker = off);
