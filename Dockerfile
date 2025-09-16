FROM node:24

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile

COPY . .

ENV PORT=9000
EXPOSE 9000

RUN npm run build

CMD ["yarn", "start"]