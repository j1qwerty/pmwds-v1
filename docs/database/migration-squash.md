# Database migration history

The repository keeps two migration steps and nothing else:

1. `20260630000000_InitialCreate` — the full current schema, written so it applies cleanly to both SQL Server and SQLite.
2. `20261005010000_AddUtilizationCertificateAndDocumentCategory` — adds `ProjectDocuments.Category` and the `UtilizationCertificates` table.

Retired objects are no longer part of the baseline at all. `TimeEntries`, `AIProviderCredentials.ApiKey` and `AIGlobalSettings.IsActive` are absent from `InitialCreate`, because the entity model no longer contains them. The previous `SchemaCleanup` migration, which dropped those objects after creating them, has been removed: SQLite cannot execute `DropColumnOperation`, so the cleanup could never run on a SQLite database.

`ApplicationDbContextModelSnapshot` matches the current model. `dotnet ef migrations has-pending-model-changes` reports no drift.

## A database from the old migration history

If `__EFMigrationsHistory` still lists migration IDs that no longer exist in the repository, the database cannot be migrated: EF tries to create tables that are already there and fails.

The application detects this at startup and refuses to start, naming the unknown migration IDs and pointing back here. It will not drop the database for you — see below.

Baseline an existing database:

1. Back it up, and test the procedure on a copy.
2. Remove anything the retired model dropped, if it still exists:
   - `DROP TABLE TimeEntries`
   - drop `AIProviderCredentials.ApiKey`
   - drop `AIGlobalSettings.IsActive`
   - drop `Tasks.ActualHours` (removed with the timer feature; delay prediction now uses elapsed days)
3. Verify `ProjectDocuments.Category` and `UtilizationCertificates` exist. Add them from the second migration's SQL when they do not.
4. Replace the rows in `__EFMigrationsHistory` with the two IDs above.

## Destructive resets are opt-in

Setting `Database__AllowDevelopmentReset=true` lets the application drop and recreate the database from `InitialCreate` when migration fails or the schema comes back incomplete. It applies to Development only, and it destroys the database's data.

It is **off by default**. Previously these resets happened automatically in Development, so a stale migration history or any transient migration error silently deleted the developer's database — the data loss was the only symptom. Now startup fails with an explanation and the database is left alone.

## Fresh database

Run the normal application migration flow. The two migrations build the current schema on either provider.

## Existing database

Do not run this history against a database that was migrated with the old, unsquashed migration files. Its `__EFMigrationsHistory` contains migration IDs that no longer exist in the repository, so EF cannot reason about its state.

Back up first, then baseline:

1. Take a full database backup and test the procedure on a copy.
2. Confirm the application tables are present.
3. Remove anything the retired model dropped, if it still exists:
   - `DROP TABLE TimeEntries` (SQLite) / the equivalent on SQL Server
   - drop `AIProviderCredentials.ApiKey`
   - drop `AIGlobalSettings.IsActive`
4. Verify `ProjectDocuments.Category` and `UtilizationCertificates` exist. Add them with the SQL from the second migration when they do not.
5. Replace the rows in `__EFMigrationsHistory` with the two IDs above.
6. Start the application and confirm the startup migration check reports nothing pending.

The API also runs a small SQLite compatibility pass (`EnsureSqliteCompatibilityColumnsAsync`) after migrations. It adds columns that older SQLite databases are missing, such as the `Users` token columns, and drops `AIGlobalSettings.IsActive` if a legacy database still carries it.

## Provider secrets

AI provider API keys are never stored in the database and are never sent to the client. Credentials come from environment-backed configuration (`AI__OpenAI__ApiKey`, `AI__OpenRouter__ApiKey`).
