FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ARG HOTEL_SITE_URL=https://booking.happylandhoteldiani.co.ke
ENV HOTEL_SITE_URL=${HOTEL_SITE_URL}
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    HOTEL_DATABASE_PATH=/app/data/happyland.sqlite \
    HOTEL_MEDIA_PATH=/app/data/room-media
COPY --from=build --chown=node:node /app ./
RUN mkdir -p /app/data/room-media && chown -R node:node /app/data
USER node
EXPOSE 3000
CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0", "--port", "3000"]
