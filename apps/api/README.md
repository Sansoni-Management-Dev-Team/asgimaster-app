# API

The member backend runs as one Hono application with PostgreSQL persistence and Better Auth. Read the [feature specifications](../../docs/features/README.md) for required behaviour and acceptance criteria, and the [high-level designs](../../docs/hldd/README.md) for design choices and constraints.

## Local development

Run package commands from the repository root. Install once there, start the isolated Postgres/mailbox services, and create local settings from the [example](.env.example). Keep environment files untracked.

```sh
npm install
npm run auth:up
cp apps/api/.env.example apps/api/.env.local
npm run api:migrate
npm run api:dev
```

The [Compose file](../../compose.auth.yml) is authoritative for service ports and local-only credentials. The example config connects to it; the mail transport captures messages locally rather than sending to members. Use `npm run auth:down` to stop these local services.

The [controlled bootstrap command](src/commands.ts) provisions named staff and isolated member fixtures. Fixtures use synthetic addresses and are not proof of a live Maxio roster. For example, after migration:

```sh
npm run api:bootstrap -- staff --email staff@example.test --name 'Local staff' --role admin
npm run api:bootstrap -- member-fixture --email member@example.test --name 'Local member' --actor-email staff@example.test
```

This is isolated capture-mail verification. The [restore-before-invitation gate](../../docs/features/authentication.md#invitation-release-gate) applies before enabling member invitations outside those local tests.

## Verification

Normal workspace checks are available from the root. For the PostgreSQL suite, supply `TEST_DATABASE_URL` pointing to a disposable database whose name ends in `_test`; the suite resets its schemas. Run `npm run api:test:integration`. `TEST_SMTP_PORT` enables the capture transport check against the local mailbox. Never point these tests at an environment database.

Build the production container from the root:

```sh
docker build -f apps/api/Dockerfile -t mlai-sansoni-api .
```

The [Dockerfile](Dockerfile), [package scripts](package.json) and [CI workflow](../../.github/workflows/ci.yml) define the authoritative build and checks. The member API, auth and staff boundaries are defined in [source](src/); validated cross-app contracts live in [the contracts workspace](../../packages/contracts/). Both health probes must remain independent of the database.

## Release operations

The [deploy workflow](../../.github/workflows/main.yml) supplies reviewed settings through the existing secret/environment delivery path. [Runtime configuration](src/config.ts) validates them, including verified database TLS and a real email transport for deployed environments. Keep all credentials outside source and the app bundle.

Before a migration-bearing release, verify database connectivity from ECS, sender permissions and delivery handling, authorised staff bootstrap, restore evidence and the intended environment. The [migration entrypoint](scripts/migrate-ecs.mjs) snapshots the database, starts the locked migration in the service network and retains recovery references even if migration fails. The service update is gated on successful migration. An image rollback does not roll back schema changes.

Live deployment and infrastructure apply require the user's instruction. Infrastructure remains in [infra/](../../infra/README.md) under Sansoni DevOps review. Production domains, app-link signing associations, live SES delivery/bounces and real membership integration require their own verification; local capture tests do not certify them.
