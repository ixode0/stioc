FROM node:22.15.0

RUN corepack enable

RUN mkdir /upterm
WORKDIR /upterm

# Кэш-слой pnpm: копируем только манифесты для кэширования зависимостей
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# Копируем остальной код (включая icons и build ресурсы)
COPY . /upterm
# Явное копирование иконок/ресурсов для electron-builder (на случай .dockerignore)
COPY icons ./icons
COPY build ./build

RUN pnpm run compile
RUN pnpm run pack

VOLUME /dist
CMD cp /upterm/dist/*.AppImage /dist
