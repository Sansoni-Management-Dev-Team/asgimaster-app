# Build from the repository root so npm uses the workspace lockfile.
FROM node:24-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/mobile/package.json apps/mobile/
COPY packages/contracts/package.json packages/contracts/
RUN npm ci --workspace @mlai-sansoni/api --workspace @mlai-sansoni/contracts --ignore-scripts

FROM deps AS build
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN npm run build --workspace @mlai-sansoni/contracts && npm run build --workspace @mlai-sansoni/api

# Export the real member app for the same origin as the API. Never inline a
# developer's native API URL or read local environment files into the bundle.
FROM node:24-alpine AS web-build
WORKDIR /repo
ENV CI=1 EXPO_NO_TELEMETRY=1 EXPO_PUBLIC_API_URL=same-origin
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/mobile/package.json apps/mobile/
COPY packages/contracts/package.json packages/contracts/
RUN npm ci --ignore-scripts
COPY packages/contracts packages/contracts
COPY apps/mobile apps/mobile
RUN npm run build --workspace @mlai-sansoni/contracts && npm exec --workspace @mlai-sansoni/mobile -- expo export --platform web --output-dir dist

FROM node:24-alpine AS prod-deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/mobile/package.json apps/mobile/
COPY packages/contracts/package.json packages/contracts/
RUN npm ci --workspace @mlai-sansoni/api --workspace @mlai-sansoni/contracts --omit=dev --omit=optional --ignore-scripts

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=prod-deps /repo/node_modules node_modules
COPY --from=prod-deps /repo/apps/api/node_modules apps/api/node_modules
COPY --from=prod-deps /repo/packages/contracts/node_modules packages/contracts/node_modules
COPY --from=build /repo/packages/contracts/dist packages/contracts/dist
COPY packages/contracts/package.json packages/contracts/
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY apps/api/package.json apps/api/
COPY apps/api/migrations apps/api/migrations
COPY --from=web-build /repo/apps/mobile/dist apps/api/public/app
WORKDIR /repo/apps/api
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
