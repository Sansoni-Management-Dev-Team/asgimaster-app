# API

The backend for the member app. It is a TypeScript server built with [Hono](https://hono.dev) and runs on Node in a container.

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

ECS runs the image on ARM (Graviton). On an Intel machine or in CI, add `--platform linux/arm64` to the build.

## Endpoints

- `GET /health` returns `{"status":"ok"}`. The AWS load balancer uses this path to decide whether a container is healthy, so it must not depend on the database.

## Database settings

On AWS, the container receives these environment variables for Postgres. Nothing reads them yet.

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`, which ECS reads from Secrets Manager at startup.
