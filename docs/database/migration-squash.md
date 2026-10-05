# Database migration squash

The repository now keeps three migration steps:

1. `20260630000000_InitialCreate`
2. `20261005000000_SchemaCleanup`
3. `20261005010000_AddUtilizationCertificateAndDocumentCategory`

The cleanup migration removes the retired `TimeEntries` table, removes persisted AI provider API keys, and removes the obsolete `AIGlobalSettings.IsActive` column.

The final migration adds `ProjectDocuments.Category` and `UtilizationCertificates`.

## Fresh database

Run the normal application migration flow. The three migrations build the current schema.

## Existing database

Do not run this squash against a production database without a backup.

Existing databases contain the old migration IDs in `__EFMigrationsHistory`. The old migration source files were intentionally removed from the repository, so an already-migrated database must be baselined before the normal application startup can use the new history.

For an existing database that already has the current utilization-certificate schema, the baseline process is:

1. Take a full database backup.
2. Confirm the current database contains the expected application tables.
3. Apply the schema cleanup equivalent if the old columns/timer table still exist:
   - drop `AIProviderCredentials.ApiKey`
   - drop `AIGlobalSettings.IsActive`
   - drop `TimeEntries`
4. Verify `ProjectDocuments.Category` and `UtilizationCertificates` exist. Add them using the final migration SQL when they do not.
5. Replace the rows in `__EFMigrationsHistory` with the three migration IDs above.
6. Start the application and confirm startup migration checks complete without pending migrations.

Use the database's normal backup/restore process and test the baseline on a copy first.

## Why this is separate

The code refactor removes timer features and persisted provider secrets. Keeping the migration history aligned with that model prevents future EF migration generation from carrying those retired tables and fields forward.

The client/API never receives provider API keys. Provider credentials come from environment configuration.
