FROM node:24

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile

COPY prisma ./prisma

RUN npx prisma generate

COPY . .

ENV PORT=3000
EXPOSE 3000

RUN npm run build

CMD ["yarn", "start"]