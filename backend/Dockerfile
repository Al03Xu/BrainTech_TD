FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Install dependency dulu (memanfaatkan cache layer), tanpa devDependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY index.js ./

# Jangan jalankan aplikasi sebagai root
USER node

EXPOSE 5000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/health || exit 1

CMD ["node", "index.js"]
