/* =============================================
   CUSTOMER SITE - SECURITY HARDENING
   ============================================= */

/* ===== Security Config ===== */
const CUSTOMER_SECURITY = {
  SESSION_TIMEOUT: 60 * 60 * 1000, // 60 minutes (customer can stay logged in longer)
  MAX_CART_SIZE: 50, // Maximum items in cart
  RATE_LIMIT_DELAY: 1000, // 1 second between actions
  LAST_ACTIVITY_KEY: 'customer_last_activity',
  SESSION_KEY: 'customer_session'
};

/* ===== Session Management ===== */
let customerSessionTimer = null;

function updateCustomerActivity() {
  try {
    localStorage.setItem(CUSTOMER_SECURITY.LAST_ACTIVITY_KEY, Date.now().toString());
  } catch(e) {}
}

function checkCustomerSessionTimeout() {
  try {
    const lastActivity = localStorage.getItem(CUSTOMER_SECURITY.LAST_ACTIVITY_KEY);
    if (lastActivity && Date.now() - parseInt(lastActivity) > CUSTOMER_SECURITY.SESSION_TIMEOUT) {
      localStorage.removeItem(CUSTOMER_SECURITY.SESSION_KEY);
      localStorage.removeItem(CUSTOMER_SECURITY.LAST_ACTIVITY_KEY);
      return true;
    }
  } catch(e) {}
  return false;
}

function safeShowToast(msg, dur) {
  if (typeof showToast === 'function') showToast(msg, dur);
}

function startCustomerSessionTimer() {
  // Check every 5 minutes
  customerSessionTimer = setInterval(() => {
    if (checkCustomerSessionTimeout()) {
    safeShowToast('Session expired. Please refresh the page.', 5000);
  }
  }, 5 * 60 * 1000);
  
  // Update activity on user interaction
  ['click', 'keypress', 'scroll', 'touchstart'].forEach(event => {
    document.addEventListener(event, updateCustomerActivity, { passive: true });
  });
  
  // Initial activity update
  updateCustomerActivity();
}

/* ===== Cart Size Validation ===== */
function validateCartSize(cart) {
  if (!Array.isArray(cart)) return true;
  if (cart.length > CUSTOMER_SECURITY.MAX_CART_SIZE) {
    safeShowToast('Cart is too large. Please remove some items.', 5000);
    return false;
  }
  return true;
}

/* ===== Rate Limiting ===== */
let lastActionTime = 0;

function isRateLimited() {
  const now = Date.now();
  if (now - lastActionTime < CUSTOMER_SECURITY.RATE_LIMIT_DELAY) {
    return true;
  }
  lastActionTime = now;
  return false;
}

/* ===== Input Sanitization ===== */
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/* ===== Phone Number Validation ===== */
function validatePhone(phone) {
  // Bangladesh phone number format
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  const isValid = /^(?:\+88|88)?01[3-9]\d{8}$/.test(cleaned);
  return {
    valid: isValid,
    cleaned: cleaned,
    formatted: cleaned.replace(/^(?:\+88|88)?(01[3-9]\d{8})$/, '+88$1')
  };
}

/* ===== Address Validation ===== */
function validateAddress(address) {
  if (!address || address.trim().length < 10) {
    return {
      valid: false,
      error: 'Address must be at least 10 characters'
    };
  }
  if (address.length > 500) {
    return {
      valid: false,
      error: 'Address must be less than 500 characters'
    };
  }
  return {
    valid: true,
    sanitized: sanitizeInput(address.trim())
  };
}

/* ===== Order Validation ===== */
function validateOrder(order) {
  const errors = [];
  
  // Validate customer info
  if (!order.customerName || order.customerName.trim().length < 2) {
    errors.push('Name must be at least 2 characters');
  }
  
  if (!order.phone) {
    errors.push('Phone number is required');
  } else {
    const phoneValidation = validatePhone(order.phone);
    if (!phoneValidation.valid) {
      errors.push('Invalid phone number');
    }
  }
  
  if (!order.address) {
    errors.push('Address is required');
  } else {
    const addressValidation = validateAddress(order.address);
    if (!addressValidation.valid) {
      errors.push(addressValidation.error);
    }
  }
  
  // Validate cart
  if (!order.items || order.items.length === 0) {
    errors.push('Cart is empty');
  } else if (!validateCartSize(order.items)) {
    errors.push('Too many items in cart');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/* ===== XSS Protection ===== */
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/* ===== CSRF Protection (for forms) ===== */
function generateCSRFToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/* ===== Security Logger ===== */
function logCustomerSecurityEvent(event, details) {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, event, details };
  
  try {
    const logs = JSON.parse(localStorage.getItem('customer_security_logs') || '[]');
    logs.push(logEntry);
    // Keep only last 20 logs
    if (logs.length > 20) logs.shift();
    localStorage.setItem('customer_security_logs', JSON.stringify(logs));
  } catch(e) {}
}

/* ===== Initialize Customer Security ===== */
function initCustomerSecurity() {
  // Start session timer
  startCustomerSessionTimer();
  
  // Check session on load
  if (checkCustomerSessionTimeout()) {
    safeShowToast('Session expired. Please refresh the page.', 5000);
  }
  
  console.log('[SECURITY] Customer security initialized');
}

/* ===== Export functions ===== */
window.customerSecurity = {
  validatePhone,
  validateAddress,
  validateOrder,
  sanitizeInput,
  escapeHtml,
  isRateLimited,
  validateCartSize,
  logSecurityEvent: logCustomerSecurityEvent
};

/* ===== Auto-initialize on DOM ready ===== */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCustomerSecurity);
} else {
  initCustomerSecurity();
}

console.log('[SECURITY] Customer security module loaded');