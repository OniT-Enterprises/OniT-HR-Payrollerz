#!/usr/bin/env bash
# deploy.sh - Deploy OpenClaw Meza gateway to production server
# Usage: ./deploy.sh [--rebuild]
#
# Idempotent: safe to run multiple times.
# --rebuild: force Docker image rebuild with --no-cache

set -euo pipefail

# --- Configuration ---
SERVER="65.109.173.122"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_hetzner}"
REMOTE_DIR="/opt/openclaw-meza"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REBUILD=false

if [[ "${1:-}" == "--rebuild" ]]; then
  REBUILD=true
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# --- Pre-flight checks ---
if [[ ! -f "$SSH_KEY" ]]; then
  error "SSH key not found at $SSH_KEY. Set SSH_KEY env var or use default ~/.ssh/id_hetzner"
fi

SSH_CMD="ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new root@$SERVER"
RSYNC_CMD="rsync -avz --delete -e 'ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new'"

# --- Step 1: Install Docker on server if missing ---
info "Checking Docker installation on server..."
DOCKER_INSTALLED=$($SSH_CMD 'command -v docker >/dev/null 2>&1 && echo "yes" || echo "no"')

if [[ "$DOCKER_INSTALLED" == "no" ]]; then
  info "Installing Docker on server..."
  $SSH_CMD 'curl -fsSL https://get.docker.com | sh'
  $SSH_CMD 'systemctl enable docker && systemctl start docker'
  info "Docker installed successfully"
else
  info "Docker already installed"
fi

# Ensure docker compose plugin is available
COMPOSE_AVAILABLE=$($SSH_CMD 'docker compose version >/dev/null 2>&1 && echo "yes" || echo "no"')
if [[ "$COMPOSE_AVAILABLE" == "no" ]]; then
  info "Installing Docker Compose plugin..."
  $SSH_CMD 'apt-get update && apt-get install -y docker-compose-plugin'
fi

# --- Step 2: Create remote directory ---
info "Creating remote directory $REMOTE_DIR..."
$SSH_CMD "mkdir -p $REMOTE_DIR"

# --- Step 3: Sync files (excluding secrets and node_modules) ---
info "Syncing files to server..."
eval $RSYNC_CMD \
  --exclude='.env' \
  --exclude='openclaw.json' \
  --exclude='node_modules' \
  --exclude='.git' \
  "$SCRIPT_DIR/" "root@$SERVER:$REMOTE_DIR/"

# --- Step 4: Create .env from example if missing ---
ENV_EXISTS=$($SSH_CMD "test -f $REMOTE_DIR/.env && echo 'yes' || echo 'no'")
if [[ "$ENV_EXISTS" == "no" ]]; then
  info "Creating .env from .env.example..."
  $SSH_CMD "cp $REMOTE_DIR/.env.example $REMOTE_DIR/.env"
  warn "Edit $REMOTE_DIR/.env on the server with your real ANTHROPIC_API_KEY"
  warn "   ssh -i $SSH_KEY root@$SERVER 'nano $REMOTE_DIR/.env'"
fi

# --- Step 5: Upload openclaw.json if not already on server ---
CONFIG_EXISTS=$($SSH_CMD "test -f $REMOTE_DIR/openclaw.json && echo 'yes' || echo 'no'")
if [[ "$CONFIG_EXISTS" == "no" ]]; then
  if [[ -f "$SCRIPT_DIR/openclaw.json" ]]; then
    info "Uploading openclaw.json..."
    scp -i "$SSH_KEY" "$SCRIPT_DIR/openclaw.json" "root@$SERVER:$REMOTE_DIR/openclaw.json"
  else
    info "Creating openclaw.json from example..."
    $SSH_CMD "cp $REMOTE_DIR/openclaw.json.example $REMOTE_DIR/openclaw.json"
    warn "Edit $REMOTE_DIR/openclaw.json on the server with your real API key and tenant ID"
    warn "   ssh -i $SSH_KEY root@$SERVER 'nano $REMOTE_DIR/openclaw.json'"
  fi
fi

# --- Step 6: Build Docker image ---
if [[ "$REBUILD" == "true" ]]; then
  info "Building Docker image (--no-cache)..."
  $SSH_CMD "cd $REMOTE_DIR && docker compose build --no-cache"
else
  info "Building Docker image..."
  $SSH_CMD "cd $REMOTE_DIR && docker compose build"
fi

# --- Step 7: Start container ---
info "Starting OpenClaw Meza container..."
$SSH_CMD "cd $REMOTE_DIR && docker compose down 2>/dev/null || true && docker compose up -d"

# --- Step 8: Verify ---
info "Waiting for container to start..."
sleep 5

CONTAINER_STATUS=$($SSH_CMD "docker ps --filter name=openclaw-meza --format '{{.Status}}'" || echo "not running")
info "Container status: $CONTAINER_STATUS"

if echo "$CONTAINER_STATUS" | grep -q "Up"; then
  echo ""
  info "OpenClaw Meza deployed successfully!"
  echo ""
  echo "  Container: openclaw-meza"
  echo "  Dashboard: http://127.0.0.1:18790 (via Nginx at /openclaw/)"
  echo ""
  echo "  Next steps:"
  echo "  1. Edit .env with Anthropic API key (if not done):"
  echo "     ssh -i $SSH_KEY root@$SERVER 'nano $REMOTE_DIR/.env'"
  echo ""
  echo "  2. Edit openclaw.json with Meza API key + tenant ID (if not done):"
  echo "     ssh -i $SSH_KEY root@$SERVER 'nano $REMOTE_DIR/openclaw.json'"
  echo ""
  echo "  3. Pair WhatsApp:"
  echo "     ssh -i $SSH_KEY root@$SERVER 'docker compose -f $REMOTE_DIR/docker-compose.yml exec -it openclaw-meza openclaw channels login'"
  echo ""
  echo "  4. Access dashboard via Nginx:"
  echo "     https://payroll.naroman.tl/openclaw/"
  echo ""
  echo "  5. View logs:"
  echo "     ssh -i $SSH_KEY root@$SERVER 'docker logs -f openclaw-meza'"
else
  warn "Container may not be running. Check logs:"
  echo "  ssh -i $SSH_KEY root@$SERVER 'docker logs openclaw-meza'"
fi
