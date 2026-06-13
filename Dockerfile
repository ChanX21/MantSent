FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/index.html ./index.html
COPY --from=build /app/styles.css ./styles.css
COPY --from=build /app/assets ./assets
COPY --from=build /app/favicon.ico ./favicon.ico
COPY --from=build /app/favicon.png ./favicon.png
COPY --from=build /app/favicon-32.png ./favicon-32.png
COPY --from=build /app/favicon.svg ./favicon.svg
COPY --from=build /app/apple-touch-icon.png ./apple-touch-icon.png
RUN mkdir -p data
EXPOSE 5173
CMD ["node", "dist/src/server/main.js"]
