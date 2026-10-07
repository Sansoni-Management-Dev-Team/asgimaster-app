# mlai-sansoni

This repository holds the Sansoni member app. It has three parts.

| Folder        | What it is                                                          |
| ------------- | ------------------------------------------------------------------- |
| `apps/mobile` | The iOS and Android app, built with Expo and React Native.          |
| `apps/api`    | The backend, a TypeScript Hono server that runs in a container.     |
| `infra`       | Terraform for the AWS resources the backend runs on.                |
| `docs`        | Product requirements and design. Start with `docs/architecture.md`. |

The apps are npm workspaces, so there is one `package-lock.json` at the root.

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

GitHub Actions runs `.github/workflows/ci.yml` on every pull request and on pushes to `main`. It runs these checks:

- Lint, typecheck and tests for both apps.
- A build of the API container.
- `terraform fmt` and `terraform validate`.

`.github/workflows/deploy-api.yml` is a stub that you run by hand. It fails with "not implemented" until someone adds the deploy steps.

Each folder has its own README with more detail:

- [apps/mobile/README.md](apps/mobile/README.md)
- [apps/api/README.md](apps/api/README.md)
- [infra/README.md](infra/README.md)
