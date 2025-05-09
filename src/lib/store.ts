import { create } from 'zustand';
import { supabase } from './supabase';

interface Notification {
  id: string;
  title: string;
  description: string;
  scheduled_at: string;
  created_by: string;
  assigned_to: string;
  is_delivered: boolean;
}

interface UserState {
  currentTime: any;
  user: any | null;
  role: 'head' | 'employee' | 'admin' | 'e.head' | 'e.employee' | 'finance.employee'  | null;
  notifications: Notification[];
  impersonatedUser: any | null;
  impersonatedRole: 'head' | 'employee' | 'admin' | 'e.head' | 'e.employee' | 'finance.employee'  | null;
  originalUser: any | null;
  originalRole: 'head' | 'employee' | 'admin' | 'e.head' | 'e.employee' | 'finance.employee'  | null;
  setUser: (user: any) => void;
  setRole: (role: 'head' | 'employee' | 'admin' | 'e.head' | 'e.employee' | 'finance.employee'  | null) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'is_delivered'>) => Promise<void>;
  markNotificationAsDelivered: (id: string) => Promise<void>;
  logout: () => void;
  impersonateUser: (user: any, role: 'head' | 'employee' | 'admin' | 'e.head' | 'e.employee' | 'finance.employee' | null) => void;
  stopImpersonation: () => void;
}

export const useStore = create<UserState>((set, get) => ({
  user: null,
  role: null,
  currentTime: null,
  notifications: [],
  impersonatedUser: null,
  impersonatedRole: null,
  originalUser: null,
  originalRole: null,
  setUser: (user) => set({ user }),
  setRole: (role) => set({ role }),
  addNotification: async (notification) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert([{
          ...notification,
          is_delivered: false
        }])
        .select();

      if (error) throw error;
      if (data) {
        set((state) => ({
          notifications: [...state.notifications, ...data]
        }));
      }
    } catch (error) {
      console.error('Error adding notification:', error);
    }
  },
  markNotificationAsDelivered: async (id) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_delivered: true })
        .eq('id', id);

      set((state) => ({
        notifications: state.notifications.map(n =>
          n.id === id ? { ...n, is_delivered: true } : n
        )
      }));
    } catch (error) {
      console.error('Error marking notification as delivered:', error);
    }
  },
  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, role: null, notifications: [], currentTime: null, impersonatedUser: null, impersonatedRole: null, originalUser: null, originalRole: null });
  },
  impersonateUser: (user, role: 'head' | 'employee' | 'admin' | 'e.head' | 'e.employee' | 'finance.employee' | null) => {
    set((state) => {
      // Store original user data if not already stored
      if (!state.originalUser) {
        return {
          impersonatedUser: user,
          impersonatedRole: role,
          user: user,
          role: role,
          originalUser: state.user,
          originalRole: state.role
        };
      }
      return {
        impersonatedUser: user,
        impersonatedRole: role,
        user: user,
        role: role
      };
    });
  },
  stopImpersonation: () => {
    set((state) => ({
      impersonatedUser: null,
      impersonatedRole: null,
      user: state.originalUser,
      role: state.originalRole,
      originalUser: null,
      originalRole: null
    }));
  },
}));