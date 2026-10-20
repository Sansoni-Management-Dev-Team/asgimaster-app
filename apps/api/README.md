# API

The backend for the member app. It is a TypeScript server built with [Hono](https://hono.dev) and runs on Node in a container.

Read the [feature specifications](../../docs/features/README.md) for required behaviour and acceptance criteria, and the [high-level designs](../../docs/hldd/README.md) for design choices and constraints.

## Run it locally

Install dependencies from the repository root first. Then start the server with reload on save.

```sh
npm run dev        # http://localhost:3000
npm test
npm run typecheck
```

The server reads `PORT` from the environment and defaults to 3000.

## Build the container

Build from the repository root, because the image needs the root `package-lock.json`.

```sh
docker build -f apps/api/Dockerfile -t mlai-sansoni-api .
docker run --rm -p 3000:3000 mlai-sansoni-api
```

Sansoni's ECS task uses x86. The GitHub Actions runner builds the image for that architecture from the repository root.

## Endpoints

- `GET /` returns `{"status":"ok"}` for the existing load balancer target group health check.
- `GET /health` returns the same response for the task definition container health check.

Both routes return 200 without calling the database.

## Deployment and database settings

AWS resources are defined in [infra/](../../infra/README.md). The app repository is [Sansoni-Management-Dev-Team/asgimaster-app](https://github.com/Sansoni-Management-Dev-Team/asgimaster-app).

The root `.github/workflows/main.yml` follows Sansoni's empireone pattern using their shared actions. It deploys only relevant pushes to `main`, with `taskdef.json` as the container definition template. The `app` container listens on port 3000 and uses 256 CPU units and 512 MB of memory.

The generated S3 environment file contains `PORT=3000` and the database keys that exist in `asgi-secrets-develop`. The API only reads `PORT` today. These are the database key names used by Sansoni's pipeline:

| Key                      | Status                               |
| ------------------------ | ------------------------------------- |
| `DATABASE_MAIN_USERNAME` | Present in the secret configuration. |
| `DATABASE_MAIN_PASSWORD` | Present in the secret configuration. |
| `DATABASE_MAIN_HOST`     | Validate when wiring database access. |
| `DATABASE_MAIN_PORT`     | Validate when wiring database access. |
| `DATABASE_MAIN_DATABASE` | Validate when wiring database access. |

The workflow reads the secret by name, so it does not need the generated ARN suffix. The `.env` file uses `asgi-main-develop`, the provisioned S3 bucket. The task execution role can read it. Rodney's infrastructure handoff is complete per Tom; the health-only API has not demonstrated database access. There are no migrations yet. Agree a migration step with Rodney when the database code is added.
