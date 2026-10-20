FROM node:22.18.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG CATALOG_MODE=mock
RUN CATALOG_MODE="$CATALOG_MODE" npm run build && npm prune --omit=dev

FROM node:22.18.0-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json /app/server.mjs ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
CMD ["npm", "start"]
