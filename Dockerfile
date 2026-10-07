FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN mkdir -p public/uploads && chown -R node:node public/uploads

USER node
EXPOSE 3001
CMD ["node", "server.js"]
