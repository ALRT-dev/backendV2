FROM node:24

# Remove ImageMagick and related libraries to address CVE-2023-34152.
# ImageMagick is not used by this application; `|| true` keeps the build
# resilient if the packages are absent in future base-image versions.
RUN apt-get update \
  && apt-get purge -y --auto-remove \
  'imagemagick*' \
  'libmagick*' \
  'libmagickcore*' \
  'libmagickwand*' \
  || true \
  && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency files first for better caching
COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile

# Copy prisma schema and generate client
COPY prisma ./prisma

RUN npx prisma generate

# Copy source files
COPY tsconfig.json ./
COPY serviceAccountKey.json ./
COPY src ./src

# Build the application
RUN npm run build

# Copy remaining files needed at runtime
COPY . .

EXPOSE 9000

CMD ["yarn", "start"]