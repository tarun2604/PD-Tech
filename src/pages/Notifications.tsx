import React, { useEffect, useState } from 'react';
import { Plus, Search, X, User, Users, Inbox, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';

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

interface Employee {
  id: string;
  email: string;
  full_name: string;
  role: 'head' | 'employee' | 'admin' | 'e.head' | 'e.employee' | 'finance.employee';
  created_at: string;
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeNotifications, setActiveNotifications] = useState<Notification[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [currentNotification, setCurrentNotification] = useState<Notification | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const { user, role } = useStore();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [viewMode, setViewMode] = useState<'received' | 'sent'>('received');
  
  const [newNotification, setNewNotification] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    assignTo: 'specific' as 'self' | 'role' | 'specific',
    targetRole: '' as 'head' | 'employee' | 'admin' | 'e.head' | 'e.employee' | 'finance.employee' | '',
    specificEmployee: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const roleAssignmentOptions = [
    { value: 'head', label: 'Department Head' },
    { value: 'e.head', label: 'Employee Head' },
    { value: 'admin', label: 'Admin' },
    { value: 'employee', label: 'Employee' },
    { value: 'e.employee', label: 'Executive Employee' },
    { value: 'finance.employee', label: 'Finance Employee' }
  ];

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadNotifications();
    loadEmployees();
    
    // Set up realtime subscription for notifications
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `assigned_to=eq.${user?.id}`
      }, (payload) => {
        // Ignore DELETE events
        if (payload.eventType === 'DELETE') return;
        
        // Handle INSERT and UPDATE events
        if (payload.eventType === 'INSERT') {
          setNotifications(prev => [payload.new as Notification, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setNotifications(prev => 
            prev.map(notification => 
              notification.id === payload.new.id ? payload.new as Notification : notification
            )
          );
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, viewMode]);

  useEffect(() => {
    checkActiveNotifications();
  }, [notifications, currentTime]);

  // Clean up deleted notifications
  useEffect(() => {
    const deletedIds = notifications
      .filter(n => n.is_delivered)
      .map(n => n.id);
    
    if (deletedIds.length > 0) {
      setNotifications(prev => prev.filter(n => !deletedIds.includes(n.id)));
      setActiveNotifications(prev => prev.filter(n => !deletedIds.includes(n.id)));
    }
  }, [notifications]);

  function showNotificationPopup(notification: Notification) {
    const sender = getEmployeeDetails(notification.created_by);
    const popup = document.createElement('div');
    popup.className = 'fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg border-l-4 border-blue-500 z-50 max-w-sm';
    popup.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <h3 class="font-bold text-gray-800">${notification.title}</h3>
          <p class="text-sm text-gray-600 mt-1">${notification.description}</p>
          <div class="flex items-center mt-2 text-xs text-gray-500">
            <span>From: ${sender?.full_name || 'Unknown'} (${sender?.role || 'Unknown'})</span>
          </div>
        </div>
        <button class="text-gray-400 hover:text-gray-600 ml-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
    `;
    
    const dismissBtn = popup.querySelector('button');
    dismissBtn?.addEventListener('click', () => {
      popup.remove();
    });
    
    document.body.appendChild(popup);
    
    setTimeout(() => {
      popup.remove();
    }, 5000);
  }

  async function loadEmployees() {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('full_name', { ascending: true });
      
      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error loading employees:', error);
      setError('Failed to load employee list. Please refresh the page.');
    }
  }

  async function loadNotifications() {
    setLoading(true);
    try {
      let query = supabase
        .from('notifications')
        .select('*');
      
      if (viewMode === 'received') {
        query = query.eq('assigned_to', user?.id);
      } else {
        query = query.eq('created_by', user?.id);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
      setError('Failed to load notifications. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function checkActiveNotifications() {
    const now = currentTime;
    const active = notifications.filter(notification => {
      const scheduledTime = new Date(notification.scheduled_at);
      return scheduledTime <= now && !notification.is_delivered;
    });
    setActiveNotifications(active);
  }

  function getEmployeeDetails(employeeId: string) {
    return employees.find(emp => emp.id === employeeId);
  }

  async function handleCreateNotification(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!newNotification.date || !newNotification.time) {
        throw new Error('Please select both date and time');
      }

      const dateTimeString = `${newNotification.date}T${newNotification.time}`;
      const scheduledAt = new Date(dateTimeString).toISOString();

      let assignToIds: string[] = [];

      if (newNotification.assignTo === 'self') {
        assignToIds = [user?.id || ''];
      } else if (newNotification.assignTo === 'role') {
        if (!newNotification.targetRole) {
          throw new Error('Please select a role to assign to');
        }
        
        const { data: roleUsers, error: roleError } = await supabase
          .from('employees')
          .select('id')
          .eq('role', newNotification.targetRole);
        
        if (roleError) throw roleError;
        assignToIds = roleUsers?.map(user => user.id) || [];
        
        if (assignToIds.length === 0) {
          throw new Error(`No employees found with role: ${newNotification.targetRole}`);
        }
      } else if (newNotification.assignTo === 'specific') {
        if (!newNotification.specificEmployee) {
          throw new Error('Please select an employee to assign to');
        }
        assignToIds = [newNotification.specificEmployee];
      }

      if (assignToIds.length === 0) {
        throw new Error('No recipients selected for notification');
      }

      const { data, error } = await supabase
        .from('notifications')
        .insert(assignToIds.map(userId => ({
          title: newNotification.title,
          description: newNotification.description,
          scheduled_at: scheduledAt,
          created_by: user?.id,
          assigned_to: userId,
          is_delivered: false,
          target_role: newNotification.assignTo === 'role' ? newNotification.targetRole : null
        })))
        .select();

      if (error) throw error;

      setNewNotification({ 
        title: '', 
        description: '', 
        date: '', 
        time: '', 
        assignTo: 'specific',
        targetRole: '',
        specificEmployee: ''
      });
      setShowAddModal(false);
      
      setError(`Notification sent successfully to ${assignToIds.length} recipient(s)!`);
      setTimeout(() => setError(''), 3000);
    } catch (error: any) {
      console.error('Error creating notification:', error);
      setError(error.message || 'Failed to create notification');
    } finally {
      setLoading(false);
    }
  }

  async function deleteNotification(id: string) {
    try {
      // First mark as delivered to prevent it from showing as new
      await supabase
        .from('notifications')
        .update({ is_delivered: true })
        .eq('id', id);
      
      // Then delete it
      await supabase
        .from('notifications')
        .delete()
        .eq('id', id);
      
      // Remove from both notifications and activeNotifications
      setNotifications(prev => prev.filter(n => n.id !== id));
      setActiveNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Error deleting notification:', error);
      setError('Failed to delete notification');
    }
  }

  async function clearAllNotifications() {
    if (!confirm('Are you sure you want to clear all notifications?')) return;
    
    try {
      const notificationIds = activeNotifications.map(n => n.id);
      
      // First mark all as delivered
      await supabase
        .from('notifications')
        .update({ is_delivered: true })
        .in('id', notificationIds);
      
      // Then delete them
      await supabase
        .from('notifications')
        .delete()
        .in('id', notificationIds);
      
      // Remove from both state arrays
      setNotifications(prev => prev.filter(n => !notificationIds.includes(n.id)));
      setActiveNotifications(prev => prev.filter(n => !notificationIds.includes(n.id)));
    } catch (error) {
      console.error('Error clearing notifications:', error);
      setError('Failed to clear notifications');
    }
  }

  async function assignNotification(
    notificationId: string, 
    assignTo: 'self' | 'role' | 'specific', 
    targetRole?: 'head' | 'employee' | 'admin' | 'e.head' | 'e.employee' | 'finance.employee', 
    specificEmployee?: string
  ) {
    setLoading(true);
    setError('');
    
    try {
      let assignToIds: string[] = [];

      if (assignTo === 'self') {
        assignToIds = [user?.id || ''];
      } else if (assignTo === 'role' && targetRole) {
        const { data: roleUsers, error: roleError } = await supabase
          .from('employees')
          .select('id')
          .eq('role', targetRole);
        
        if (roleError) throw roleError;
        assignToIds = roleUsers?.map(user => user.id) || [];
        
        if (assignToIds.length === 0) {
          throw new Error(`No employees found with role ${targetRole}`);
        }
      } else if (assignTo === 'specific' && specificEmployee) {
        assignToIds = [specificEmployee];
      } else {
        throw new Error('Invalid assignment parameters');
      }

      const { error: deleteError } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (deleteError) throw deleteError;

      const { data, error } = await supabase
        .from('notifications')
        .insert(assignToIds.map(userId => ({
          ...currentNotification,
          id: undefined,
          assigned_to: userId,
          is_delivered: false,
          target_role: assignTo === 'role' ? targetRole : null
        })))
        .select();

      if (error) throw error;

      setNotifications(prev => [
        ...(data as Notification[]),
        ...prev.filter(n => n.id !== notificationId)
      ]);
      setShowAssignModal(false);
      
      setError(`Notification reassigned successfully to ${assignToIds.length} recipient(s)!`);
      setTimeout(() => setError(''), 3000);
    } catch (error: any) {
      console.error('Error assigning notification:', error);
      setError(error.message || 'Failed to assign notification');
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Notification Center</h1>
          <div className="text-sm text-gray-500">
            Current Time: {currentTime.toLocaleTimeString()} - {currentTime.toLocaleDateString()}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative w-64">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="w-5 h-5 text-gray-400" />
            </div>
            <input
              type="search"
              placeholder="Search Notifications"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full p-2 pl-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          {activeNotifications.length > 0 && viewMode === 'received' && (
            <button
              onClick={clearAllNotifications}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg flex items-center gap-2"
              disabled={loading}
            >
              <X className="w-4 h-4" />
              <span>Clear All</span>
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
            disabled={loading}
          >
            <Plus className="w-4 h-4" />
            <span>Add Notification</span>
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setViewMode('received')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
            viewMode === 'received' ? 'bg-blue-600 text-white' : 'bg-gray-200'
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>Received</span>
        </button>
        <button
          onClick={() => setViewMode('sent')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
            viewMode === 'sent' ? 'bg-blue-600 text-white' : 'bg-gray-200'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Sent</span>
        </button>
      </div>

      {error && (
        <div className={`mb-4 p-4 border rounded ${
          error.includes('successfully') 
            ? 'bg-green-100 border-green-400 text-green-700' 
            : 'bg-red-100 border-red-400 text-red-700'
        }`}>
          {error}
        </div>
      )}

      {loading && !notifications.length ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : activeNotifications.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">
            {viewMode === 'received' 
              ? 'No received notifications' 
              : 'No sent notifications'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeNotifications
            .filter(notification => 
              notification.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              notification.description?.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map((notification) => {
              const sender = getEmployeeDetails(notification.created_by);
              const recipient = getEmployeeDetails(notification.assigned_to);
              
              return (
                <div
                  key={notification.id}
                  className={`bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow w-full relative ${
                    !notification.is_delivered && viewMode === 'received' ? 'border-l-4 border-blue-500' : ''
                  }`}
                >
                  {viewMode === 'received' && (
                    <button
                      onClick={() => deleteNotification(notification.id)}
                      className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                      title="Dismiss notification"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                  
                  <div className="flex justify-between items-start pr-6">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-800 mb-2">
                        {notification.title || 'New Notification'}
                      </h3>
                      {notification.description && (
                        <p className="text-gray-600 mb-4">{notification.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-gray-500">
                          Scheduled: {formatDate(notification.scheduled_at)} at {formatTime(notification.scheduled_at)}
                        </span>
                        {viewMode === 'received' ? (
                          <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                            From: {sender?.full_name || 'Unknown'} ({sender?.role || 'Unknown'})
                          </span>
                        ) : (
                          <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                            To: {recipient?.full_name || 'Unknown'} ({recipient?.role || 'Unknown'})
                          </span>
                        )}
                        {notification.target_role && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            Role: {roleAssignmentOptions.find(r => r.value === notification.target_role)?.label || notification.target_role}
                          </span>
                        )}
                        {!notification.is_delivered && viewMode === 'received' && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            New
                          </span>
                        )}
                      </div>
                    </div>
                    {(role === 'head' || role === 'admin') && viewMode === 'sent' && (
                      <button
                        onClick={() => {
                          setCurrentNotification(notification);
                          setShowAssignModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
                        title="Reassign notification"
                      >
                        <Users className="w-4 h-4" />
                        Reassign
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Add Notification Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Create Notification</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-500 hover:text-gray-700"
                disabled={loading}
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleCreateNotification}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2 font-medium">Title *</label>
                <input
                  type="text"
                  value={newNotification.title}
                  onChange={(e) => setNewNotification({ ...newNotification, title: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  required
                  disabled={loading}
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2 font-medium">Description</label>
                <textarea
                  value={newNotification.description}
                  onChange={(e) => setNewNotification({ ...newNotification, description: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  disabled={loading}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-gray-700 mb-2 font-medium">Date *</label>
                  <input
                    type="date"
                    value={newNotification.date}
                    onChange={(e) => setNewNotification({ ...newNotification, date: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    required
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2 font-medium">Time *</label>
                  <input
                    type="time"
                    value={newNotification.time}
                    onChange={(e) => setNewNotification({ ...newNotification, time: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    required
                    disabled={loading}
                  />
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 mb-2 font-medium">Assign To</label>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50">
                    <input
                      type="radio"
                      name="assignTo"
                      value="self"
                      checked={newNotification.assignTo === 'self'}
                      onChange={() => setNewNotification({ 
                        ...newNotification, 
                        assignTo: 'self',
                        targetRole: '',
                        specificEmployee: ''
                      })}
                      className="h-4 w-4"
                      disabled={loading}
                    />
                    <div>
                      <p className="font-medium">Only me</p>
                      <p className="text-sm text-gray-500">Create this notification just for yourself</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50">
                    <input
                      type="radio"
                      name="assignTo"
                      value="role"
                      checked={newNotification.assignTo === 'role'}
                      onChange={() => setNewNotification({ 
                        ...newNotification, 
                        assignTo: 'role',
                        specificEmployee: ''
                      })}
                      className="h-4 w-4"
                      disabled={loading}
                    />
                    <div className="flex-1">
                      <p className="font-medium">By Role</p>
                      <p className="text-sm text-gray-500 mb-2">Assign to all users with a specific role</p>
                      {newNotification.assignTo === 'role' && (
                        <select
                          value={newNotification.targetRole}
                          onChange={(e) => setNewNotification({ 
                            ...newNotification, 
                            targetRole: e.target.value as any 
                          })}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                          required={newNotification.assignTo === 'role'}
                          disabled={loading}
                        >
                          <option value="">Select a role</option>
                          {roleAssignmentOptions.map(role => (
                            <option key={role.value} value={role.value}>
                              {role.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50">
                    <input
                      type="radio"
                      name="assignTo"
                      value="specific"
                      checked={newNotification.assignTo === 'specific'}
                      onChange={() => setNewNotification({ 
                        ...newNotification, 
                        assignTo: 'specific',
                        targetRole: ''
                      })}
                      className="h-4 w-4"
                      disabled={loading || employees.length === 0}
                    />
                    <div className="flex-1">
                      <p className="font-medium">Specific Person</p>
                      <p className="text-sm text-gray-500 mb-2">Assign to a specific employee</p>
                      {newNotification.assignTo === 'specific' && (
                        <select
                          value={newNotification.specificEmployee}
                          onChange={(e) => setNewNotification({ 
                            ...newNotification, 
                            specificEmployee: e.target.value 
                          })}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                          required={newNotification.assignTo === 'specific'}
                          disabled={loading || employees.length === 0}
                        >
                          <option value="">Select an employee</option>
                          {employees.map(employee => (
                            <option key={employee.id} value={employee.id}>
                              {employee.full_name} ({employee.role})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </label>
                </div>
              </div>
              
              {error && (
                <div className="mb-4 p-2 bg-red-100 text-red-700 text-sm rounded">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={loading}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !newNotification.title || !newNotification.date || !newNotification.time || 
                    (newNotification.assignTo === 'role' && !newNotification.targetRole) ||
                    (newNotification.assignTo === 'specific' && !newNotification.specificEmployee)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </>
                  ) : (
                    'Create Notification'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Notification Modal */}
      {showAssignModal && currentNotification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Reassign Notification</h2>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-gray-500 hover:text-gray-700"
                disabled={loading}
              >
                ✕
              </button>
            </div>
            
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">{currentNotification.title}</h3>
              {currentNotification.description && (
                <p className="text-gray-600 mb-4">{currentNotification.description}</p>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 mb-4 font-medium">Assign To</label>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => assignNotification(currentNotification.id, 'self')}
                  disabled={loading}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  <div className="p-2 bg-blue-100 rounded-full">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Only me</p>
                    <p className="text-sm text-gray-500">Assign this notification only to yourself</p>
                  </div>
                </button>

                <div className="p-3 border rounded-lg">
                  <h4 className="font-medium mb-2">Assign to Role</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {roleAssignmentOptions.map(role => (
                      <button
                        key={role.value}
                        onClick={() => assignNotification(
                          currentNotification.id, 
                          'role', 
                          role.value as any
                        )}
                        disabled={loading}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded disabled:opacity-50"
                      >
                        <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                        <span>{role.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 border rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assign to Specific Employee
                  </label>
                  <select
                    value={newNotification.specificEmployee}
                    onChange={(e) => setNewNotification({ 
                      ...newNotification, 
                      specificEmployee: e.target.value 
                    })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm mb-2"
                    disabled={loading || employees.length === 0}
                  >
                    <option value="">Select an employee</option>
                    {employees.map(employee => (
                      <option key={employee.id} value={employee.id}>
                        {employee.full_name} ({employee.role})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => assignNotification(
                      currentNotification.id, 
                      'specific', 
                      undefined, 
                      newNotification.specificEmployee
                    )}
                    disabled={loading || !newNotification.specificEmployee}
                    className="w-full mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                  >
                    Assign to Selected
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-2 bg-red-100 text-red-700 text-sm rounded">
                {error}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}