# Media Roulette game server.
#   docker build -t media-roulette-server .
#   docker run -p 6969:6969 media-roulette-server

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine
ENV NODE_ENV=production \
    PORT=6969 \
    UPLOADS_DIR=/data/uploads
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# Media is short-lived (deleted after each game, 3 hours at most): no volume needed.
RUN mkdir -p /data/uploads && chown -R node:node /data
USER node
EXPOSE 6969
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- "http://127.0.0.1:${PORT}/health" || exit 1
CMD ["node", "dist/server.js"]
