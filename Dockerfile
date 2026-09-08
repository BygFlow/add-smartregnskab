# ADD SmartRegnskab — Dockerfile til dedikeret server / VPS
# Byg: docker build -t add-smartregnskab .
# Kør: docker run -p 5000:5000 -v /var/data:/var/data --env-file .env add-smartregnskab

FROM node:22.12-slim

WORKDIR /app

# Installer build-afhængigheder til better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Kopier package files og installer
COPY package*.json ./
RUN npm ci

# Kopier kildekode og byg
COPY --chown=node:node . .
RUN npm run build

# Oprydning
RUN npm prune --production

RUN mkdir -p /var/data/files /var/data/backups && chown -R node:node /var/data /app

# Persistent data volume
VOLUME ["/var/data"]

ENV NODE_ENV=production
ENV DATABASE_PATH=/var/data/data.db
ENV FILE_STORAGE_DIR=/var/data/files
ENV BACKUP_DIR=/var/data/backups

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:5000/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Render monterer den vedvarende disk efter image-buildet. Ret derfor ejerskabet
# ved hver containerstart og skift derefter til den uprivilegerede node-bruger.
CMD ["sh", "-c", "chown -R node:node /var/data && exec su -s /bin/sh node -c 'exec node dist/index.cjs'"]
