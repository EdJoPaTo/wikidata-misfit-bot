FROM docker.io/library/node:14 AS builder
WORKDIR /build

COPY package.json package-lock.json tsconfig.json ./
RUN npm ci

COPY source source
RUN node_modules/.bin/tsc

RUN rm -rf node_modules && npm ci --production


FROM docker.io/bitnami/node:14-prod
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/dist ./

CMD node --unhandled-rejections=strict -r source-map-support/register index.js
