FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install --production=false

# Copy source and build (client + server)
COPY . .
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Copy built server + client bundle and runtime deps
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# SQLite DB directory (mounted as volume in compose)
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "dist/index.js"]

