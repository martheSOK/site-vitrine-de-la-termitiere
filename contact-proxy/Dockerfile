FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js sector-emails.json ./

ENV PORT=8081
EXPOSE 8081

CMD ["node", "server.js"]
