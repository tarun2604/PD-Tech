import { Bell, BellRing } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

interface Notification {
  id: string;
  title: string;
  description: string;
  scheduled_at: string;
  created_by: string;
  assigned_to: string;
  is_delivered: boolean;
  target_role?: string;
  created_at: string;
}

interface NotificationBellProps {
  userId: string;
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load notifications from localStorage on component mount
  useEffect(() => {
    const storedNotifications = localStorage.getItem('notifications');
    if (storedNotifications) {
      const parsedNotifications = JSON.parse(storedNotifications);
      setNotifications(parsedNotifications);
      const unreadCount = parsedNotifications.filter((n: Notification) => !n.is_delivered).length;
      setUnreadCount(unreadCount);
    }
  }, []);

  // Save notifications to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000); // Refresh every 30 seconds

    // Set up realtime subscription
    const channel = supabase
      .channel('notifications_bell')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `or(assigned_to.eq.${userId},created_by.eq.${userId})`
      }, (payload) => {
        console.log('Realtime notification received:', payload);
        
        // Ignore DELETE events
        if (payload.eventType === 'DELETE') {
          setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
          return;
        }
        
        // Handle INSERT and UPDATE events
        if (payload.eventType === 'INSERT') {
          const newNotification = payload.new as Notification;
          setNotifications(prev => [newNotification, ...prev]);
          if (!newNotification.is_delivered) {
            setUnreadCount(count => count + 1);
          }
        } else if (payload.eventType === 'UPDATE') {
          const updatedNotification = payload.new as Notification;
          setNotifications(prev => 
            prev.map(notification => 
              notification.id === updatedNotification.id ? updatedNotification : notification
            )
          );
          // Update unread count if delivery status changed
          if (payload.old.is_delivered !== updatedNotification.is_delivered) {
            setUnreadCount(count => updatedNotification.is_delivered ? count - 1 : count + 1);
          }
        }
      })
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  async function loadNotifications() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
        .order('scheduled_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      if (data) {
        // Merge with existing notifications from localStorage
        const storedNotifications = localStorage.getItem('notifications');
        const existingNotifications = storedNotifications ? JSON.parse(storedNotifications) : [];
        
        // Combine and deduplicate notifications
        const combinedNotifications = [...data, ...existingNotifications]
          .filter((notification, index, self) => 
            index === self.findIndex(n => n.id === notification.id)
          )
          .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
        
        setNotifications(combinedNotifications);
        const unreadCount = combinedNotifications.filter(n => !n.is_delivered).length;
        setUnreadCount(unreadCount);
        console.log('Loaded notifications:', combinedNotifications.length, 'Unread:', unreadCount);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }

  async function markAsDelivered(id: string) {
    try {
      await supabase
        .from('notifications')
        .update({ is_delivered: true })
        .eq('id', id);
      
      // Update local state
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === id ? { ...notification, is_delivered: true } : notification
        )
      );
      setUnreadCount(prev => prev - 1);
    } catch (error) {
      console.error('Error marking notification as delivered:', error);
    }
  }

  async function markAllAsRead() {
    const unreadIds = notifications
      .filter(n => !n.is_delivered)
      .map(n => n.id);
    
    if (unreadIds.length > 0) {
      try {
        await supabase
          .from('notifications')
          .update({ is_delivered: true })
          .in('id', unreadIds);
        
        // Update local state
        setNotifications(prev => 
          prev.map(notification => 
            unreadIds.includes(notification.id) 
              ? { ...notification, is_delivered: true } 
              : notification
          )
        );
        setUnreadCount(0);
      } catch (error) {
        console.error('Error marking all notifications as read:', error);
      }
    }
  }

  async function deleteAllNotifications() {
    if (notifications.length === 0) return;
    
    try {
      const notificationIds = notifications.map(n => n.id);
      
      const { error } = await supabase
        .from('notifications')
        .delete()
        .in('id', notificationIds);
      
      if (error) {
        console.error('Error deleting notifications:', error);
        return;
      }
      
      // Clear both state and localStorage
      setNotifications([]);
      setUnreadCount(0);
      localStorage.removeItem('notifications');
      console.log('All notifications deleted successfully');
    } catch (error) {
      console.error('Error deleting notifications:', error);
    }
  }

  function formatDate(dateString: string) {
    return format(new Date(dateString), 'MMM dd, yyyy - h:mm a');
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-full hover:bg-gray-100 relative"
        aria-label="Notifications"
      >
        {unreadCount > 0 ? (
          <BellRing className="w-5 h-5 text-yellow-500 animate-pulse" />
        ) : (
          <Bell className="w-5 h-5 text-gray-500" />
        )}
        
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-md shadow-lg z-50 border border-gray-200">
          <div className="p-3 border-b border-gray-200 flex justify-between items-center">
            <h3 className="font-medium text-gray-800">Notifications</h3>
            <div className="flex gap-2">
              {notifications.length > 0 && (
                <button 
                  onClick={deleteAllNotifications}
                  className="text-red-600 text-xs hover:underline"
                  title="Delete all notifications"
                >
                  Delete All
                </button>
              )}
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  className="text-blue-600 text-xs hover:underline"
                  title="Mark all notifications as read"
                >
                  Mark all as read
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No notifications</div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 border-b border-gray-100 hover:bg-gray-50 ${
                    !notification.is_delivered ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-gray-800">{notification.title}</h4>
                      <p className="text-sm text-gray-600">{notification.description}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(notification.scheduled_at)}
                      </p>
                    </div>
                    {!notification.is_delivered && (
                      <button
                        onClick={() => markAsDelivered(notification.id)}
                        className="text-blue-600 text-xs hover:underline"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}