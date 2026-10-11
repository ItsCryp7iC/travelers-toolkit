let subscribers = new Set();
let notifications = [];
let nextId = 1;

function emit() {
  for (const subscriber of subscribers) {
    try {
      subscriber(notifications);
    } catch (e) {
      console.error('Error notifying subscriber:', e);
    }
  }
}

export function subscribeNotifications(callback) {
  subscribers.add(callback);
  callback(notifications);
  return () => {
    subscribers.delete(callback);
  };
}

export function dismissNotification(id) {
  notifications = notifications.filter((n) => n.id !== id);
  emit();
}

export function clearNotifications() {
  notifications = [];
  emit();
}

export function getNotifications() {
  return [...notifications];
}

function addNotification(type, message, options = {}) {
  const text = typeof message === 'string' ? message.trim() : String(message || '');
  if (!text) return null;

  // Deduplicate active notification of same type and message
  const isDuplicate = notifications.some(
    (n) => n.type === type && n.message === text
  );
  if (isDuplicate) return null;

  const id = `notif-${nextId++}`;
  const duration = options.duration ?? (type === 'error' ? 8000 : type === 'warning' ? 6000 : 4000);

  const item = {
    id,
    type,
    message: text,
    duration,
    createdAt: Date.now(),
  };

  notifications = [...notifications, item];
  emit();

  if (duration > 0) {
    setTimeout(() => {
      dismissNotification(id);
    }, duration);
  }

  return id;
}

export const notify = {
  success: (msg, opts) => addNotification('success', msg, opts),
  error: (msg, opts) => addNotification('error', msg, opts),
  warning: (msg, opts) => addNotification('warning', msg, opts),
  info: (msg, opts) => addNotification('info', msg, opts),
  dismiss: dismissNotification,
  clear: clearNotifications,
  getNotifications,
};

export default notify;
