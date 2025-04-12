import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { Plus, Phone, Mail, Check, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { intervalToDuration } from 'date-fns';
import { parseISO } from 'date-fns';

interface ChecklistItem {
  id: string;
  client_id: string;
  item_key: string;
  label: string;
  assigned?: string;
  completed: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export default function AllClientProfile() {
    const { id } = useParams<{ id: string }>();
    const [client, setClient] = useState<any>(null);
    const [contactPersons, setContactPersons] = useState<any[]>([]);
    const [showAddContactModal, setShowAddContactModal] = useState(false);
    const [editContact, setEditContact] = useState<any>(null);
    const role = useStore((state) => state.role);
    // Removed unused 'user' variable
    const [createdByEmployee, setCreatedByEmployee] = useState<any>(null);
    const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
    const [loading, setLoading] = useState(true);

    const [newContact, setNewContact] = useState({
        name: '',
        position: '',
        email: '',
        phone: '',
    });

    const checklistTemplate = [
        { item_key: 'customer_relation', label: 'Customer Relation' },
        { item_key: 'appointment', label: 'Appointment', assigned: 'Mr. Ashik' },
        { item_key: 'repent', label: 'Repent', assigned: 'Mr. Subramani' },
        { item_key: 'repent_approval', label: 'Repent Approval', assigned: 'Mrs. Shankari / Mrs. Remiga' },
        { item_key: 'repent_transfer', label: 'Repent Transfer for Performance Allowance', assigned: 'Mr. Dilip Kumar' },
        { item_key: 'repent_support', label: 'Repent Support to customers', assigned: 'Mr. Subramani' },
        { item_key: 'expected_sheet', label: 'Expected Sheet', assigned: 'Mrs. Sapna' },
        { item_key: 'feedback_call', label: 'Feedback Call', assigned: 'Mrs. Remiga' },
        { item_key: 'dock_harbor', label: 'Dock Harbor/User / Performance Allowance Approval' },
        { item_key: 'tax_invoice_mobility', label: 'Tax Invoice Mobility', assigned: 'Mr. Sundar' },
        { item_key: 's_sheets_handbye', label: 'S Sheets Handbye', assigned: 'Mrs. Shankari' },
        { item_key: 'tax_invoice_tally', label: 'Tax Invoice Tally', assigned: 'Mrs. Sapa' },
        { item_key: 'g2_checking', label: 'G2 Checking In', assigned: 'Mr. Loganeth' },
        { item_key: 'tax_invoice_approval', label: 'Tax Invoice Approval', assigned: 'Mrs. Shankari' },
        { item_key: 's_sheets_printout', label: 'S Sheets Printout', assigned: 'Mr. Subramani' },
        { item_key: 'tax_invoice_email', label: 'Tax Invoice Email', assigned: 'Mr. Sundar' },
        { item_key: 'daily_expenses', label: 'Daily Expenses Monitor', assigned: 'Mrs. Sapna' },
        { item_key: 'payment_reminder', label: 'Payment Reminder', assigned: 'Mr. Sundar' },
        { item_key: 'site_advance_payment', label: 'Site Advance Payment', assigned: 'Mr. Dilip Kumar' },
        { item_key: 'payment_received', label: 'Payment Received', assigned: 'Mrs. Shankari' },
        { item_key: 'site_advance_approval', label: 'Site Advance Approval', assigned: 'Mr. Subramani' },
        { item_key: 'site_budget', label: 'Site Budget', assigned: 'Mrs. Sapna' },
        { item_key: 'r1_checking', label: 'R1 Checking On', assigned: 'Mr. Zhailaan / Mr. Keyn' },
        { item_key: 'm5_chaos', label: 'M5 Chaos Last Verified', assigned: 'Mr. Subramani' },
        { item_key: 'toolbox_talk', label: 'Tool Box Talk', assigned: 'Mrs. Remiga' },
    ];

    useEffect(() => {
        if (id) {
            loadClientData();
            loadChecklist();
        }
    }, [id]);

    async function loadChecklist() {
        setLoading(true);
        try {
            const { data: existingItems, error } = await supabase
                .from('checklist_items')
                .select('*')
                .eq('client_id', id)
                .order('created_at', { ascending: true });

            if (error) throw error;

            const now = new Date().toISOString();
            const mergedChecklist = checklistTemplate.map(templateItem => {
                const existingItem = existingItems?.find(item => item.item_key === templateItem.item_key);
                
                return existingItem || {
                    client_id: id,
                    item_key: templateItem.item_key,
                    label: templateItem.label,
                    assigned: templateItem.assigned,
                    completed: false,
                    notes: '',
                    created_at: now,
                    updated_at: now,
                };
            });

            setChecklist(mergedChecklist);
        } catch (error) {
            console.error('Error loading checklist:', error);
        } finally {
            setLoading(false);
        }
    }

    async function saveChecklistItem(item: ChecklistItem) {
        try {
            const { data: existingItem, error: fetchError } = await supabase
                .from('checklist_items')
                .select('id')
                .eq('client_id', id)
                .eq('item_key', item.item_key)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

            const now = new Date().toISOString();
            const updateData = {
                ...item,
                updated_at: now,
                completed_at: item.completed ? (item.completed_at || now) : null
            };

            let error;
            
            if (existingItem) {
                const { error: updateError } = await supabase
                    .from('checklist_items')
                    .update(updateData)
                    .eq('id', existingItem.id);
                error = updateError;
            } else {
                const { error: insertError } = await supabase
                    .from('checklist_items')
                    .insert([{
                        ...updateData,
                        created_at: now
                    }]);
                error = insertError;
            }

            if (error) throw error;
        } catch (error) {
            console.error('Error saving checklist item:', error);
        }
    }

    const getTimeBetweenSteps = (currentIndex: number) => {
        if (currentIndex === 0) return null;
        
        const currentItem = checklist[currentIndex];
        const prevItem = checklist[currentIndex - 1];
        
        if (!prevItem?.completed_at) {
            return 'Waiting for previous step to complete';
        }
        
        if (!currentItem?.completed_at) {
            return 'Current step not completed yet';
        }
        
        try {
            const prevCompleted = parseISO(prevItem.completed_at);
            const currentCompleted = parseISO(currentItem.completed_at);
            
            if (isNaN(prevCompleted.getTime())) {
                return 'Invalid previous step completion time';
            }
            
            if (isNaN(currentCompleted.getTime())) {
                return 'Invalid current step completion time';
            }
            
            const duration = intervalToDuration({
                start: prevCompleted,
                end: currentCompleted
            });
            
            // Format the duration in a human-readable way
            const parts = [];
            if (duration.days) parts.push(`${duration.days}d`);
            if (duration.hours) parts.push(`${duration.hours}h`);
            if (duration.minutes) parts.push(`${duration.minutes}m`);
            
            const timeBetween = parts.join(' ');
            
            return `Completed ${timeBetween || 'a few moments'} after previous step`;
        } catch (error) {
            console.error('Error calculating time between steps:', error);
            return 'Time data error';
        }
    };
    const getStepDuration = (item: ChecklistItem) => {
        if (!item.completed || !item.created_at || !item.completed_at) {
            return null;
        }
        
        try {
            const start = parseISO(item.created_at);
            const end = parseISO(item.completed_at);
            
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return 'Invalid time data';
            }
            
            const duration = intervalToDuration({ start, end });
            
            const parts = [];
            if (duration.days) parts.push(`${duration.days}d`);
            if (duration.hours) parts.push(`${duration.hours}h`);
            if (duration.minutes) parts.push(`${duration.minutes}m`);
            
            return parts.join(' ') || 'Less than a minute';
        } catch (error) {
            console.error('Error calculating duration:', error);
            return 'Duration error';
        }
    };

    const handleCheckboxChange = async (itemKey: string) => {
        const updatedChecklist = checklist.map(item =>
            item.item_key === itemKey ? { 
                ...item, 
                completed: !item.completed,
                completed_at: !item.completed ? new Date().toISOString() : undefined
            } : item
        );
        
        setChecklist(updatedChecklist);

        const updatedItem = updatedChecklist.find(item => item.item_key === itemKey);
        if (updatedItem) {
            await saveChecklistItem(updatedItem);
        }
    };

    const handleNoteChange = async (itemKey: string, value: string) => {
        setChecklist(prev =>
            prev.map(item =>
                item.item_key === itemKey ? { ...item, notes: value } : item
            )
        );

        const updatedItem = checklist.find(item => item.item_key === itemKey);
        if (updatedItem) {
            await saveChecklistItem({
                ...updatedItem,
                notes: value
            });
        }
    };

    async function loadClientData() {
        try {
            const { data: clientData, error } = await supabase
                .from('clients')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            setClient(clientData);

            const { data: contactData, error: contactError } = await supabase
                .from('contact_persons')
                .select('*')
                .eq('client_id', id)
                .order('created_at', { ascending: false });

            if (contactError) throw contactError;
            setContactPersons(contactData || []);

            if (clientData?.created_by) {
                await loadEmployeeData(clientData.created_by);
            }
        } catch (error) {
            console.error('Error loading client data:', error);
        }
    }

    async function loadEmployeeData(userId: string) {
        try {
            const { data: employeeData, error } = await supabase
                .from('employees')
                .select('full_name')
                .eq('id', userId)
                .single();

            if (error) throw error;
            setCreatedByEmployee(employeeData);
        } catch (error) {
            console.error('Error loading employee data:', error);
        }
    }

    async function handleAddContact(e: React.FormEvent) {
        e.preventDefault();

        try {
            const { error } = await supabase
                .from('contact_persons')
                .insert([{ ...newContact, client_id: id }]);

            if (error) throw error;

            setNewContact({ name: '', position: '', email: '', phone: '' });
            setShowAddContactModal(false);
            loadClientData();
        } catch (error) {
            console.error('Error adding contact person:', error);
        }
    }

    async function handleUpdateContact(e: React.FormEvent) {
        e.preventDefault();

        try {
            const { error } = await supabase
                .from('contact_persons')
                .update({
                    name: editContact.name,
                    position: editContact.position,
                    email: editContact.email,
                    phone: editContact.phone,
                })
                .eq('id', editContact.id);

            if (error) throw error;

            setEditContact(null);
            loadClientData();
        } catch (error) {
            console.error('Error updating contact person:', error);
        }
    }

    if (!client) return <div className="p-6">Loading client data...</div>;

    return (
        <div className="space-y-6">
            {/* Client Header */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">{client.name}</h1>
                        <p className="text-gray-600">{client.company}</p>
                        <p className="text-gray-500 mt-2">{client.address}</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowAddContactModal(true)}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700 transition-colors"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Contact
                        </button>
                    </div>
                </div>
            </div>

            {/* Checklist Section */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Workflow Checklist</h2>
                {loading ? (
                    <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {checklist.map((item, index) => (
                            <div key={item.item_key} className="space-y-2">
                                {/* Time between steps */}
                                {index > 0 && (
                                    <div className="flex items-center text-xs text-gray-500 ml-5 pl-5 border-l-2 border-gray-200">
                                        <Clock className="w-3 h-3 mr-1" />
                                        {getTimeBetweenSteps(index)}
                                    </div>
                                )}

                                {/* Checklist item */}
                                <div className="flex items-start gap-4">
                                    <div className="flex items-center mt-1">
                                        <input
                                            type="checkbox"
                                            id={item.item_key}
                                            checked={item.completed}
                                            onChange={() => handleCheckboxChange(item.item_key)}
                                            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-start justify-between">
                                            <label htmlFor={item.item_key} className="block text-gray-800">
                                                {item.label}
                                                {item.assigned && (
                                                    <span className="text-sm text-gray-500 ml-2">({item.assigned})</span>
                                                )}
                                            </label>
                                            {item.completed && item.completed_at && (
                                                <span className="text-xs text-gray-500">
                                                    Completed: {formatDistanceToNow(new Date(item.completed_at), { addSuffix: true })}
                                                </span>
                                            )}
                                        </div>
                                        
                                        <input
                                            type="text"
                                            placeholder="Add notes..."
                                            value={item.notes || ''}
                                            onChange={(e) => handleNoteChange(item.item_key, e.target.value)}
                                            className="w-full mt-1 p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                        
                                        {/* Duration */}
                                        {item.completed && (
                                            <div className="text-xs text-gray-500 mt-1 flex items-center">
                                                <Clock className="w-3 h-3 mr-1" />
                                                Duration: {getStepDuration(item)}
                                            </div>
                                        )}
                                    </div>
                                    {item.completed && (
                                        <div className="text-green-500 flex items-center">
                                            <Check className="w-5 h-5" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            {/* Client Created By */}
            {role === 'head' && client.created_by && (
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Client Created By</h2>
                    {createdByEmployee ? (
                        <p className="text-gray-600">Employee Name: {createdByEmployee?.full_name}</p>
                    ) : (
                        <p className="text-gray-600">User ID: {client.created_by}</p>
                    )}
                </div>
            )}

            {/* Contact Persons */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Contact Persons</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {contactPersons.map((contact) => (
                        <div key={contact.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                            <h3 className="font-semibold text-gray-800">{contact.name}</h3>
                            <p className="text-gray-600 text-sm">{contact.position}</p>
                            <div className="mt-2 space-y-1">
                                <div className="flex items-center text-gray-600 text-sm">
                                    <Mail className="w-4 h-4 mr-2" />
                                    {contact.email || 'No email'}
                                </div>
                                <div className="flex items-center text-gray-600 text-sm">
                                    <Phone className="w-4 h-4 mr-2" />
                                    {contact.phone || 'No phone'}
                                </div>
                            </div>
                            {role === 'head' && (
                                <button
                                    onClick={() => setEditContact(contact)}
                                    className="mt-2 px-3 py-1 bg-gray-200 text-sm rounded hover:bg-gray-300 transition-colors"
                                >
                                    Edit
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Add Contact Modal */}
            {showAddContactModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                        <h2 className="text-xl font-bold mb-4">Add Contact Person</h2>
                        <form onSubmit={handleAddContact}>
                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2">Name*</label>
                                <input
                                    type="text"
                                    value={newContact.name}
                                    onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2">Position*</label>
                                <input
                                    type="text"
                                    value={newContact.position}
                                    onChange={(e) => setNewContact({ ...newContact, position: e.target.value })}
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2">Email*</label>
                                <input
                                    type="email"
                                    value={newContact.email}
                                    onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2">Phone*</label>
                                <input
                                    type="tel"
                                    value={newContact.phone}
                                    onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAddContactModal(false)}
                                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                >
                                    Add Contact
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Contact Modal */}
            {editContact && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                        <h2 className="text-xl font-bold mb-4">Edit Contact Person</h2>
                        <form onSubmit={handleUpdateContact}>
                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2">Name*</label>
                                <input
                                    type="text"
                                    value={editContact.name}
                                    onChange={(e) =>
                                        setEditContact({ ...editContact, name: e.target.value })
                                    }
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2">Position*</label>
                                <input
                                    type="text"
                                    value={editContact.position}
                                    onChange={(e) =>
                                        setEditContact({ ...editContact, position: e.target.value })
                                    }
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2">Email*</label>
                                <input
                                    type="email"
                                    value={editContact.email}
                                    onChange={(e) =>
                                        setEditContact({ ...editContact, email: e.target.value })
                                    }
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2">Phone*</label>
                                <input
                                    type="tel"
                                    value={editContact.phone}
                                    onChange={(e) =>
                                        setEditContact({ ...editContact, phone: e.target.value })
                                    }
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setEditContact(null)}
                                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}