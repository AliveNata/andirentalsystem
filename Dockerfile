# syntax=docker/dockerfile:1

# Node 24 LTS, patch 24.22.3 (Node.js security release 11 Nov 2026, supersedes 24.22.1 from 21 Oct 2026).
# Digest is the multi-arch index of node:24.22.3-trixie-slim, checked 2026-11-22 with
# `docker buildx imagetools inspect node:24.22.3-trixie-slim`.
ARG NODE_IMAGE=node:24.22.3-trixie-slim@sha256:af02d57b57719b9657a45199a79264a9437940cd55b3c7b3fc99615654f124a0

# Backend production dependencies. Build tools are here in case bcrypt has no prebuild for the platform.
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
  && npm cache clean --force

# Frontend build (project/dist). Exported to the host by deploy/build-frontend.sh, never shipped in the app image.
FROM ${NODE_IMAGE} AS frontend-build
WORKDIR /build
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_DOWNLOAD=1
COPY project/package.json project/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY project/ ./
# Empty on purpose: the frontend falls back to /api on the same domain.
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM scratch AS frontend-dist
COPY --from=frontend-build /build/dist/ /

# Runtime image: backend only. Files stay root-owned so the node user cannot modify the code.
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json index.js db.js ./
COPY lib/ ./lib/
COPY project/src/lib/pricing.mjs ./project/src/lib/pricing.mjs
COPY project/src/components/emailTemplates/invoiceTemplate.cjs \
     project/src/components/emailTemplates/receiptTemplate.cjs \
     project/src/components/emailTemplates/brand.cjs \
     project/src/components/emailTemplates/htmlSafe.cjs \
     ./project/src/components/emailTemplates/
COPY public/terms_and_conditions.pdf ./public/terms_and_conditions.pdf
RUN mkdir -p /data/uploads && chown node:node /data/uploads
USER node
EXPOSE 5005
CMD ["node", "index.js"]
