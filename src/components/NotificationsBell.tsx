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
        filter: `assigned_to=eq.${userId}`
      }, (payload) => {
        // Ignore DELETE events
        if (payload.eventType === 'DELETE') return;
        
        // Handle INSERT and UPDATE events
        if (payload.eventType === 'INSERT') {
          setNotifications(prev => [payload.new as Notification, ...prev]);
          if (!payload.new.is_delivered) {
            setUnreadCount(count => count + 1);
          }
        } else if (payload.eventType === 'UPDATE') {
          setNotifications(prev => 
            prev.map(notification => 
              notification.id === payload.new.id ? payload.new as Notification : notification
            )
          );
          // Update unread count if delivery status changed
          if (payload.old.is_delivered !== payload.new.is_delivered) {
            setUnreadCount(count => payload.new.is_delivered ? count - 1 : count + 1);
          }
        }
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [userId]);

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
        setNotifications(data);
        const unreadCount = data.filter(n => !n.is_delivered).length;
        setUnreadCount(unreadCount);
        console.log('Loaded notifications:', data.length, 'Unread:', unreadCount);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }

  async function markAsDelivered(id: string) {
    await supabase
      .from('notifications')
      .update({ is_delivered: true })
      .eq('id', id);
    loadNotifications();
  }

  async function markAllAsRead() {
    const unreadIds = notifications
      .filter(n => !n.is_delivered)
      .map(n => n.id);
    
    if (unreadIds.length > 0) {
      await supabase
        .from('notifications')
        .update({ is_delivered: true })
        .in('id', unreadIds);
      loadNotifications();
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
      
      setNotifications([]);
      setUnreadCount(0);
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
          
          <div className="max-h-60 overflow-y-auto">
            {loading ? (
              <div className="p-4 flex justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
              </div>
            ) : notifications.length === 0 ? (
              <p className="p-4 text-gray-500 text-center">No notifications</p>
            ) : (
              notifications.map(notification => (
                <div 
                  key={notification.id} 
                  className={`p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                    !notification.is_delivered ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => markAsDelivered(notification.id)}
                >
                  <div className="flex justify-between items-start">
                    <h4 className={`font-medium text-sm ${
                      !notification.is_delivered ? 'text-blue-600' : 'text-gray-700'
                    }`}>
                      {notification.title}
                    </h4>
                    {!notification.is_delivered && (
                      <span className="h-2 w-2 rounded-full bg-blue-500 mt-1.5"></span>
                    )}
                  </div>
                  {notification.description && (
                    <p className="text-xs text-gray-600 mt-1">{notification.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDate(notification.scheduled_at)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}