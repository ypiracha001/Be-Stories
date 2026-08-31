# be stories. — production image
# Node 24 LTS, matching package.json engines, .nvmrc and CI.
FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 \
 && rm -rf /var/lib/apt/lists/*
COPY build.py audit.py ./
COPY assets ./assets
COPY content ./content
RUN python3 build.py

FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev
COPY server ./server
COPY --from=build /app/dist ./dist
# Never bake secrets into a layer: pass them at run time.
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=4s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.js"]
