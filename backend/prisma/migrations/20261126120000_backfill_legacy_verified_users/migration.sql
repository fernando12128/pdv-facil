-- Contas criadas antes da confirmação por e-mail não possuem token EMAIL_VERIFICATION.
-- Mantém acesso aos usuários legados sem liberar contas novas com confirmação pendente.
UPDATE "User"
SET "emailVerifiedAt" = CURRENT_TIMESTAMP
WHERE "emailVerifiedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "AccountToken"
    WHERE "AccountToken"."userId" = "User"."id"
      AND "AccountToken"."purpose" = 'EMAIL_VERIFICATION'
  );
