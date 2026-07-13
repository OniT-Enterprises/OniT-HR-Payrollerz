# OpenClaw Gateway - Docker image for Xefe HR assistant
# Runs as non-root with tini for proper signal handling

FROM node:22-slim AS base

# Install tini for signal handling + git & ca-certificates (required by openclaw npm deps)
RUN apt-get update && apt-get install -y --no-install-recommends tini git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Rewrite SSH git URLs to HTTPS (openclaw deps use ssh://git@github.com/...)
RUN git config --global url."https://github.com/".insteadOf "ssh://git@github.com/"

# Install openclaw globally.
# PINNED to 2026.4.15: this is the version the xefe-hr plugin (api.registerTool)
# was built against. openclaw 2026.5.20 changed plugin/tool loading so the
# plugin's tools stop registering (0 tools). Pin here so a rebuild is
# behaviour-preserving; bump deliberately with a plugin-compat check.
RUN npm install -g openclaw@2026.4.15

# Create workspace directory for the non-root user
RUN mkdir -p /home/node/.openclaw/extensions/xefe-hr \
    && mkdir -p /home/node/.openclaw/workspace \
    && mkdir -p /home/node/.openclaw/state \
    && mkdir -p /home/node/.openclaw/credentials \
    && mkdir -p /home/node/.openclaw/canvas \
    && mkdir -p /home/node/.openclaw/cron \
    && mkdir -p /home/node/.openclaw/devices \
    && mkdir -p /home/node/.openclaw/identity \
    && chown -R node:node /home/node/.openclaw

# Copy plugin files and install dependencies
COPY --chown=node:node extensions/xefe-hr/ /home/node/.openclaw/extensions/xefe-hr/
WORKDIR /home/node/.openclaw/extensions/xefe-hr
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
