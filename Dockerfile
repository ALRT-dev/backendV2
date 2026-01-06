FROM node:24

WORKDIR /app

# Copy dependency files first for better caching
COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile

# Copy prisma schema and generate client
COPY prisma ./prisma

RUN npx prisma generate

# Copy source files
COPY tsconfig.json ./
COPY src ./src

# Build the application
RUN npm run build

# Copy remaining files needed at runtime
COPY . .

EXPOSE 9000

CMD ["yarn", "start"]