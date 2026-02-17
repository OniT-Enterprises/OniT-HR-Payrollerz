/**
 * Chat utility functions for Meza HR bot — intent classification, action detection.
 * Adapted from Rezerva hotel chatUtils for the HR/payroll domain.
 */

const CONFIRM_MESSAGE_PATTERN = /^(?:yes|yep|yeah|sure|ok(?:ay)?|confirm(?:ed)?|please proceed|proceed|go ahead|do it|yes,?\s*please\s*proceed)\b[\s.!]*$/i;
const CANCEL_MESSAGE_PATTERN = /^(?:no|cancel|stop|abort|never mind|nevermind|no thanks|do not proceed|don't proceed|no,?\s*cancel)\b[\s.!]*$/i;
const WRITE_INTENT_PATTERN = /\b(?:create|make|add|update|change|edit|modify|delete|remove|approve|reject|terminate|hire|promote|demote|transfer|assign|run\s+payroll)\b/i;
const READ_INTENT_PATTERN = /\b(?:show|list|get|find|search|view|check|status|report|summary|overview|how many|what|which|who|when|where|count)\b/i;

function sanitizeSessionKey(sessionKey, maxLen = 64) {
  if (typeof sessionKey !== 'string') return 'default';
  const trimmed = sessionKey.trim().toLowerCase();
  if (!trimmed) return 'default';
  const safe = trimmed
    .replace(/[^a-z0-9:_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen);
  return safe || 'default';
}

function isConfirmMessage(message) {
  return CONFIRM_MESSAGE_PATTERN.test((message || '').trim());
}

function isCancelMessage(message) {
  return CANCEL_MESSAGE_PATTERN.test((message || '').trim());
}

function classifyChatIntent(message) {
  const text = (message || '').trim();
  if (!text) return 'other';
  if (isConfirmMessage(text)) return 'confirm';
  if (isCancelMessage(text)) return 'cancel';
  if (WRITE_INTENT_PATTERN.test(text)) return 'write';
  if (READ_INTENT_PATTERN.test(text)) return 'read';
  return 'other';
}

function detectActions(toolNames, reply) {
  const actions = new Set();

  for (const name of toolNames || []) {
    if (/employee|staff/i.test(name)) actions.add('employee_changed');
    else if (/payroll|payslip/i.test(name)) actions.add('payroll_changed');
    else if (/leave/i.test(name)) actions.add('leave_changed');
    else if (/interview|candidate|job/i.test(name)) actions.add('recruitment_changed');
    else if (/invoice/i.test(name)) actions.add('invoice_changed');
    else if (/bill/i.test(name)) actions.add('bill_changed');
    else if (/expense/i.test(name)) actions.add('expense_changed');
    else if (/department/i.test(name)) actions.add('department_changed');
    else if (/attendance/i.test(name)) actions.add('attendance_changed');
  }

  return [...actions];
}

module.exports = {
  classifyChatIntent,
  detectActions,
  isCancelMessage,
  isConfirmMessage,
  sanitizeSessionKey,
};
