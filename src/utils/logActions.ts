import { logAction } from './logging';

export const logActions = {
    login: async (userId: string) => {
        await logAction(userId, 'login', 'User logged in');
    },
    logout: async (userId: string) => {
        await logAction(userId, 'logout', 'User logged out');
    },
    clientAdded: async (userId: string, clientId: string, clientName: string) => {
        await logAction(userId, 'client_added', `Added client: ${clientName}`, clientId);
    },
    clientUpdated: async (userId: string, clientId: string, clientName: string) => {
        await logAction(userId, 'client_updated', `Updated client: ${clientName}`, clientId);
    },
    contactAdded: async (userId: string, clientId: string, contactName: string) => {
        await logAction(userId, 'contact_added', `Added contact: ${contactName}`, clientId);
    },
    contactUpdated: async (userId: string, clientId: string, contactName: string) => {
        await logAction(userId, 'contact_updated', `Updated contact: ${contactName}`, clientId);
    },
    quotationCreated: async (userId: string, quotationId: string, clientName: string) => {
        await logAction(userId, 'quotation_created', `Created quotation for: ${clientName}`, quotationId);
    },
    quotationUpdated: async (userId: string, quotationId: string, status: string) => {
        await logAction(userId, 'quotation_updated', `Updated quotation status to: ${status}`, quotationId);
    },
    siteVisitCreated: async (userId: string, visitId: string, clientName: string, duration: string) => {
        await logAction(userId, 'site_visit_created', `Created site visit for: ${clientName} (Duration: ${duration})`, visitId);
    },
    employeeAdded: async (userId: string, employeeId: string, employeeName: string) => {
        await logAction(userId, 'employee_added', `Added employee: ${employeeName}`, employeeId);
    },
    employeeUpdated: async (userId: string, employeeId: string, employeeName: string, updates: string) => {
        await logAction(userId, 'employee_updated', `Updated employee: ${employeeName} (${updates})`, employeeId);
    },
    employeeDeactivated: async (userId: string, employeeId: string) => {
        await logAction(userId, 'employee_deactivated', `Deactivated employee`, employeeId);
    },
    employeeRestored: async (userId: string, employeeId: string) => {
        await logAction(userId, 'employee_restored', `Restored inactive employee`, employeeId);
    }
}; 