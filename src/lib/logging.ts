import { supabase } from './supabase';

export interface LogEntry {
  user_id: string;
  action: string;
  details: string;
}

export async function logAction(entry: LogEntry) {
  try {
    const { error } = await supabase
      .from('logs')
      .insert([entry]);

    if (error) {
      console.error('Error logging action:', error);
    }
  } catch (error) {
    console.error('Error logging action:', error);
  }
}

// Helper functions for common log actions
export const logActions = {
  login: (userId: string) => logAction({
    user_id: userId,
    action: 'login',
    details: 'User logged in'
  }),

  logout: (userId: string) => logAction({
    user_id: userId,
    action: 'logout',
    details: 'User logged out'
  }),

  clientAdded: (userId: string, clientId: string, clientName: string) => logAction({
    user_id: userId,
    action: 'client_added',
    details: `Added new client: ${clientName} (ID: ${clientId})`
  }),

  clientUpdated: (userId: string, clientId: string, clientName: string, changes: string) => logAction({
    user_id: userId,
    action: 'client_updated',
    details: `Updated client: ${clientName} (ID: ${clientId}). Changes: ${changes}`
  }),

  employeeAdded: (userId: string, employeeId: string, employeeName: string) => logAction({
    user_id: userId,
    action: 'employee_added',
    details: `Added new employee: ${employeeName} (ID: ${employeeId})`
  }),

  employeeUpdated: (userId: string, employeeId: string, employeeName: string, changes: string) => logAction({
    user_id: userId,
    action: 'employee_updated',
    details: `Updated employee: ${employeeName} (ID: ${employeeId}). Changes: ${changes}`
  }),

  employeeDeactivated: (userId: string, employeeId: string) => logAction({
    user_id: userId,
    action: 'employee_deactivated',
    details: `Deactivated employee (ID: ${employeeId})`
  }),

  siteVisit: (userId: string, clientId: string, clientName: string, duration: string) => logAction({
    user_id: userId,
    action: 'site_visit',
    details: `Site visit for client: ${clientName} (ID: ${clientId}). Duration: ${duration}`
  }),

  quotationCreated: (userId: string, clientId: string, clientName: string, quotationId: string) => logAction({
    user_id: userId,
    action: 'quotation_created',
    details: `Created quotation for client: ${clientName} (ID: ${clientId}). Quotation ID: ${quotationId}`
  }),

  quotationUpdated: (userId: string, quotationId: string, status: string) => logAction({
    user_id: userId,
    action: 'quotation_updated',
    details: `Updated quotation (ID: ${quotationId}). New status: ${status}`
  })
}; 