FROM node:22-alpine

WORKDIR /app

# רק להרצה – הבילד נעשה מחוץ לדוקר (npm run build על השרת)
ENV NODE_ENV=production

# התקנת תלויות להרצה בלבד
COPY package.json ./
RUN npm install --omit=dev

# העתקת הבילד המוכן (server + client) לתוך התמונה
COPY dist ./dist

# תיקיית DB (SQLite) – תמופה ל-volume בדוקר קומפוז
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "dist/index.js"]

