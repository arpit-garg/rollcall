FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY src ./src
COPY test ./test

EXPOSE 3002

CMD ["npm", "start"]
