FROM dockerhub.pr.cz/library/node:22-bookworm AS build
WORKDIR /app

ENV npm_config_registry=https://nexus.gkh.pr.cz/repository/npm-group/ \
    npm_config_update_notifier=false \
    npm_config_build_from_source=true \
    npm_config_nodedir=/usr/local

RUN command -v python3 && command -v make && command -v g++ \
    && test -f /usr/local/include/node/node.h

COPY package.json package-lock.json ./

RUN node --version && npm --version \
    && npm config get registry \
    && (npm ci --include=dev --no-audit --no-fund \
        --foreground-scripts --loglevel=verbose --logs-dir=/tmp/npm-logs \
        || { code=$?; \
             for log in /tmp/npm-logs/*-debug-*.log; do \
                 if [ -f "$log" ]; then tail -n 200 "$log"; fi; \
             done; \
             exit "$code"; })

COPY tsconfig*.json vite.config.ts ./
COPY shared ./shared
COPY server ./server
COPY web ./web
COPY scripts ./scripts

RUN npm run build \
    && npm prune --omit=dev --ignore-scripts --no-audit --no-fund

FROM dockerhub.pr.cz/library/node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/app/data/vacations.db \
    BACKUP_DIR=/app/data/backups \
    VACATION_YEAR=2027

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY scripts ./scripts

RUN mkdir -p /app/data && chown node:node /app/data

USER node

RUN node --input-type=commonjs -e "const Database = require('better-sqlite3'); const db = new Database(':memory:'); db.prepare('SELECT 1').get(); db.close();"

EXPOSE 3000
CMD ["node", "dist/server/index.js"]
