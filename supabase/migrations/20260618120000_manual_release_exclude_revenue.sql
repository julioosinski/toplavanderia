-- Liberações manuais (payment_method = manual_release) não compõem receita financeira.

CREATE OR REPLACE FUNCTION public.update_machine_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'completed') THEN
    UPDATE machines
    SET total_uses = COALESCE(total_uses, 0) + 1,
        total_revenue = COALESCE(total_revenue, 0)
          + CASE
              WHEN COALESCE(NEW.payment_method, '') = 'manual_release' THEN 0
              ELSE COALESCE(NEW.total_amount, 0)
            END,
        updated_at = now()
    WHERE id = NEW.machine_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Recalcular totais históricos das máquinas (uses = todas concluídas; revenue = exceto manual_release)
UPDATE public.machines m
SET
  total_revenue = COALESCE(stats.revenue, 0),
  total_uses = COALESCE(stats.uses, 0),
  updated_at = now()
FROM (
  SELECT
    t.machine_id,
    COUNT(*)::integer AS uses,
    COALESCE(
      SUM(t.total_amount) FILTER (
        WHERE COALESCE(t.payment_method, '') IS DISTINCT FROM 'manual_release'
      ),
      0
    ) AS revenue
  FROM public.transactions t
  WHERE t.status = 'completed'
  GROUP BY t.machine_id
) stats
WHERE m.id = stats.machine_id;
