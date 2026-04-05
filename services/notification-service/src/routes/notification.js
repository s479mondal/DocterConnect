const express = require('express');
const router = express.Router();
const { getNotifications, markAsRead, getUnreadCount } = require('../handlers/notificationHandler');

// Get notifications for a user
router.get('/', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(400).json({ error: 'User ID required' });
  
  const notifications = getNotifications(userId);
  const unread = getUnreadCount(userId);
  
  res.json({ notifications, unreadCount: unread });
});

// Mark notification as read
router.patch('/:id/read', (req, res) => {
  const success = markAsRead(req.params.id);
  if (success) {
    res.json({ message: 'Notification marked as read' });
  } else {
    res.status(404).json({ error: 'Notification not found' });
  }
});

// Get unread count
router.get('/unread-count', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(400).json({ error: 'User ID required' });
  
  const count = getUnreadCount(userId);
  res.json({ unreadCount: count });
});

module.exports = router;
