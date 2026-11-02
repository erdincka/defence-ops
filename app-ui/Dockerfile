FROM --platform=linux/amd64 node:24-slim

WORKDIR /app

# Install dependencies exactly as locked
COPY app-ui/package*.json ./
RUN npm ci

# Copy application code
COPY app-ui/ .
COPY USAGE.md DIAGRAM.md ./

# Build argument for domain
ARG DOMAIN
ENV DOMAIN=${DOMAIN}

ENV NEXT_TELEMETRY_DISABLED=1

# Build the application for production. The larger heap is for the build only: at run time it
# would let Node grow past the container's memory limit.
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

EXPOSE 3000

# Run dev if ENV=development, otherwise run production
CMD if [ "$ENV" = "development" ]; then \
      npm run dev; \
    else \
      npm start; \
    fi

