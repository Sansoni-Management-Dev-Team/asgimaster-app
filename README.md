# mlai-sansoni

This repository holds the Sansoni member app and is hosted at [Sansoni-Management-Dev-Team/asgimaster-app](https://github.com/Sansoni-Management-Dev-Team/asgimaster-app).

| Folder        | What it is                                                          |
| ------------- | ------------------------------------------------------------------- |
| `apps/mobile` | The iOS and Android app, built with Expo and React Native.          |
| `apps/api`    | The backend, a TypeScript Hono server that runs in a container.     |
| `docs`        | Product behaviour and design. Start with [feature specifications](docs/features/README.md). |

The apps are npm workspaces, so there is one `package-lock.json` at the root.

The [feature specifications](docs/features/README.md) describe required behaviour and acceptance criteria. The [high-level designs](docs/hldd/README.md) describe the design choices and constraints that support them.

For Linear access, use the native `linear` CLI with a repository `.linear.toml` selecting the workspace and the key stored in the system keyring. See the [Linear CLI setup](docs/linear.md).

## Getting started

You need Node 22 or newer. Install dependencies once from the root.

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

`.github/workflows/main.yml` follows the empireone pipeline using Sansoni's shared actions from [devops-github-workflows](https://github.com/Sansoni-Management-Dev-Team/devops-github-workflows). It runs on pushes to `main`, which deploys to `develop` (staging), and to `production`, which deploys to production. It only runs when a push changes `apps/api/**`, the root `package.json` or `package-lock.json`, the workflow itself or `taskdef.json`. It cannot run on pull requests or by manual dispatch. It builds from the repository root, uploads the environment file to S3, pushes the image to ECR, registers the task definition and updates the ECS service. There are no database migrations yet.

The environment file uses the provisioned `asgi-main-develop` S3 bucket, and the task execution role can read it. The workflow waits until the new tasks are healthy, so a deploy that cannot start fails the workflow. The API answers `/` for the existing target group health check and `/health` for the container health check. Merging an API change to `main` will trigger the deploy workflow.

Each folder has its own README with more detail:

- [apps/mobile/README.md](apps/mobile/README.md)
- [apps/api/README.md](apps/api/README.md)
