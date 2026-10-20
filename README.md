# mlai-sansoni

This repository holds the Sansoni member app and is hosted at [Sansoni-Management-Dev-Team/asgimaster-app](https://github.com/Sansoni-Management-Dev-Team/asgimaster-app).

| Folder        | What it is                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------- |
| `apps/mobile` | The iOS and Android app, built with Expo and React Native.                                  |
| `apps/api`    | The backend, a TypeScript Hono server that runs in a container.                             |
| `docs`        | Product behaviour and design. Start with [feature specifications](docs/features/README.md). |

The apps are npm workspaces, so there is one `package-lock.json` at the root.

The [feature specifications](docs/features/README.md) describe required behaviour and acceptance criteria. The [high-level designs](docs/hldd/README.md) describe the design choices and constraints that support them.

For Linear access, use the native `linear` CLI with a repository `.linear.toml` selecting the workspace and the key stored in the system keyring. See the [Linear CLI setup](docs/linear.md).

## Getting started

Use Node 24 for the API. Install dependencies once from the repository root.

```sh
npm install
```

Then run each part from the root.

```sh
npm start          # Expo dev server for the mobile app
npm run api:dev    # API on http://localhost:3000 with reload on save
```

## Checks

These scripts run in every workspace that defines them.

```sh
npm run lint
npm run typecheck
npm test
npm run format     # Prettier for the whole repository
```

## CI

GitHub Actions runs `.github/workflows/ci.yml` on every pull request and on pushes to every branch. It runs these checks:

- Lint, typecheck and tests for both apps.
- A build of the API container.

## API deployment

AWS resources are defined in [infra/](infra/README.md) with Terragrunt. The current environment is `develop` in account `806968064090`, region `ap-southeast-2`.

The [deploy workflow](.github/workflows/main.yml) uses Sansoni's shared actions and maps `main` to staging and `production` to production. Relevant pushes trigger it; pull requests run CI without deploying. Release readiness includes restore evidence and configured database/auth/email settings. A database snapshot and a successful one-off migration precede the service update; failure retains recovery references and prevents that update. See the workflow and [migration entrypoint](apps/api/scripts/migrate-ecs.mjs) for authoritative inputs and automation.

The API's probes are independent of database availability. A healthy probe alone is not evidence that authentication, email or database access works. Local setup and capture-mail verification are described in the [API README](apps/api/README.md). Live deployment and infrastructure apply require the user's instruction.

Each folder has its own README with more detail:

- [apps/mobile/README.md](apps/mobile/README.md)
- [apps/api/README.md](apps/api/README.md)
