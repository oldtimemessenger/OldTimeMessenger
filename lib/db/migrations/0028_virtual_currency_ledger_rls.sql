ALTER TABLE "virtual_currency_ledger" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'virtual_currency_ledger'
      AND policyname = 'virtual_currency_ledger_deny_direct_clients'
  ) THEN
    CREATE POLICY "virtual_currency_ledger_deny_direct_clients"
      ON "virtual_currency_ledger"
      FOR ALL
      TO anon, authenticated
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;