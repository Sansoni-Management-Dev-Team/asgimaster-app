# Build from the repository root so npm can use the workspace lockfile:
#   docker build -f apps/api/Dockerfile -t mlai-sansoni-api .

FROM node:24-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/mobile/package.json apps/mobile/
RUN npm ci --workspace @mlai-sansoni/api --ignore-scripts

FROM deps AS build
COPY apps/api apps/api
RUN npm run build --workspace @mlai-sansoni/api

FROM node:24-alpine AS prod-deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/mobile/package.json apps/mobile/
# The mobile workspace marks tsx/typescript/esbuild as optional, so --omit=dev alone keeps
# them. Revisit --omit=optional if the API gains a dependency with optional native binaries.
RUN npm ci --workspace @mlai-sansoni/api --omit=dev --omit=optional --ignore-scripts

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=prod-deps /repo/node_modules node_modules
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY apps/api/package.json apps/api/
WORKDIR /repo/apps/api
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
