FROM node:22.15.0

# system libs required by electron-builder / AppImage runtime
RUN apt-get update && apt-get install -y --no-install-recommends libgtk-3-0 libnss3 libxss1 libasound2 xvfb && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

RUN mkdir /stioc
WORKDIR /stioc

# Кэш-слой pnpm: копируем только манифесты для кэширования зависимостей
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# Копируем остальной код (включая icons и build ресурсы)
COPY . /stioc

RUN pnpm run compile
RUN pnpm run pack -- --linux AppImage deb --publish never

VOLUME /dist
CMD cp /stioc/dist/*.AppImage /stioc/dist/*.deb /dist/ 2>/dev/null; ls /dist/
