FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm install pg@8.18.0 --omit=dev

COPY deploy/events/server.mjs ./server.mjs

EXPOSE 3100

CMD ["node", "server.mjs"]
