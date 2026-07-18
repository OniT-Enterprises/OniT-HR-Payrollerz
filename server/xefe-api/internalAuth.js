/**
 * Per-process key for in-process loopback calls (agentChat's data tool →
 * this server's read-only tenant API). Random at boot, never leaves the
 * process, so it cannot be replayed externally. Requests carrying it are
 * already tenant-authorized: the chat route verified the caller's Firebase
 * membership for that tenant before the agent ran.
 */
const crypto = require('crypto');

const INTERNAL_AGENT_KEY = crypto.randomBytes(32).toString('hex');

function isInternalAgentRequest(req) {
  const key = req.headers['x-internal-agent-key'];
  if (typeof key !== 'string' || key.length !== INTERNAL_AGENT_KEY.length) return false;
  return crypto.timingSafeEqual(Buffer.from(key), Buffer.from(INTERNAL_AGENT_KEY));
}

module.exports = { INTERNAL_AGENT_KEY, isInternalAgentRequest };
