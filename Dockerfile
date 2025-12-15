FROM node:20-bullseye-slim

WORKDIR /app

# System deps needed for native modules like better-sqlite3
RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential python3 ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=8083

EXPOSE 8083

RUN chown -R node:node /app
USER node

CMD ["node", "src/server.js"]

