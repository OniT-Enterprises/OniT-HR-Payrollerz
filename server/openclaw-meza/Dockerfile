# OpenClaw Gateway - Docker image for Meza HR assistant
# Runs as non-root with tini for proper signal handling

FROM node:22-slim AS base

# Install tini for signal handling + git & ca-certificates (required by openclaw npm deps)
RUN apt-get update && apt-get install -y --no-install-recommends tini git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Rewrite SSH git URLs to HTTPS (openclaw deps use ssh://git@github.com/...)
RUN git config --global url."https://github.com/".insteadOf "ssh://git@github.com/"

# Install openclaw globally
RUN npm install -g openclaw@latest

# Create workspace directory for the non-root user
RUN mkdir -p /home/node/.openclaw/extensions/meza-hr \
    && mkdir -p /home/node/.openclaw/workspace \
    && mkdir -p /home/node/.openclaw/state \
    && mkdir -p /home/node/.openclaw/credentials \
    && mkdir -p /home/node/.openclaw/canvas \
    && mkdir -p /home/node/.openclaw/cron \
    && mkdir -p /home/node/.openclaw/devices \
    && mkdir -p /home/node/.openclaw/identity \
    && chown -R node:node /home/node/.openclaw

# Copy plugin files and install dependencies
COPY --chown=node:node extensions/meza-hr/ /home/node/.openclaw/extensions/meza-hr/
WORKDIR /home/node/.openclaw/extensions/meza-hr
RUN npm install --omit=dev

# Switch to non-root user
USER node
WORKDIR /home/node

# Gateway port
EXPOSE 18790

# Use tini as init system
ENTRYPOINT ["tini", "--"]

# Run gateway in foreground
CMD ["openclaw", "gateway", "--port", "18790"]
