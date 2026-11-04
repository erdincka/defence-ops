FROM --platform=linux/amd64 node:24-slim AS base

RUN groupadd -g 10001 app && useradd -u 10001 -g app -m app
WORKDIR /app
RUN chown app:app /app
# Everything below runs as the app user, which owns the code so that Tilt's live update works
USER 10001

# Install dependencies exactly as locked
COPY --chown=10001:10001 app-ui/package*.json ./
RUN npm ci

# Copy application code
COPY --chown=10001:10001 app-ui/ .
COPY --chown=10001:10001 USAGE.md DIAGRAM.md ./

ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000

# Tilt's dev loop: next dev compiles pages on request, so nothing is built here. .next must exist and
# belong to the app user, or the chart's cache volume at .next/cache makes it root's.
FROM base AS dev
RUN mkdir -p .next
CMD ["npm", "run", "dev"]

# Production, the default target (last, so a plain docker build builds it). The larger heap is for
# the build only: at run time it would let Node grow past the container's memory limit.
FROM base AS prod
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build
CMD ["npm", "start"]
