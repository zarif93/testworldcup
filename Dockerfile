# ============================================================
# שלב 1: בנייה – מתקין תלויות ובונה את הפרויקט (פרונט + שרת)
# ============================================================
FROM node:22-alpine AS builder

WORKDIR /app

# חשוב: לא להגדיר NODE_ENV=production כאן – כדי ש־npm install יתקין גם devDependencies (Vite, Tailwind וכו')
COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# ============================================================
# שלב 2: הרצה – רק קבצי הרצה ותלויות production
# ============================================================
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/data

# App listens on PORT (default 3000); set in .env or -e PORT=...
EXPOSE 3000
CMD ["node", "dist/index.js"]
