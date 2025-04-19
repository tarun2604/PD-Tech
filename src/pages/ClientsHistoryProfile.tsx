import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { Plus, Users, Building2, Phone, Mail, Calendar, FileText } from 'lucide-react';

export default function ClientsHistoryProfile() {
    const { id } = useParams<{ id: string }>();
    const [client, setClient] = useState<any>(null);
    const [contactPersons, setContactPersons] = useState<any[]>([]);
    const [quotations, setQuotations] = useState<any[]>([]);
    const [siteVisits, setSiteVisits] = useState<any[]>([]);
    const [assets, setAssets] = useState<any[]>([]);
    const [documents, setDocuments] = useState<any[]>([]);
    const [showDocumentModal, setShowDocumentModal] = useState(false);
    const [newDocument, setNewDocument] = useState({
        document_type: 'quotation',
        description: '',
        file: null as File | null
    });
    const [loading, setLoading] = useState({
        document: false,
        client: true
    });
    const user = useStore((state) => state.user);

    useEffect(() => {
        if (id) {
            loadClientData();
            loadAssets();
            loadDocuments();
        }
    }, [id]);

    async function loadClientData() {
        try {
            setLoading(prev => ({...prev, client: true}));
            
            // Load client details
            const { data: clientData } = await supabase
                .from('clients')
                .select('*')
                .eq('id', id)
                .single();

            setClient(clientData);

            // Load contact persons
            const { data: contactData } = await supabase
                .from('contact_persons')
                .select('*')
                .eq('client_id', id)
                .order('created_at', { ascending: false });

            setContactPersons(contactData || []);

            // Load quotations
            const { data: quotationData } = await supabase
                .from('quotations')
                .select(`
                    *,
                    employees (
                        full_name
                    ),
                    quotation_assets (
                        asset_id,
                        quantity,
                        assets (
                            item
                        )
                    )
                `)
                .eq('client_id', id)
                .order('created_at', { ascending: false });

            setQuotations(quotationData || []);

            // Load site visits
            const { data: visitData } = await supabase
                .from('site_visits')
                .select(`
                    *,
                    employees (
                        full_name
                    ),
                    site_visit_assets (
                        asset_id,
                        quantity,
                        assets (
                            item
                        )
                    )
                `)
                .eq('client_id', id)
                .order('created_at', { ascending: false });

            setSiteVisits(visitData || []);
        } catch (error) {
            console.error('Error loading client data:', error);
        } finally {
            setLoading(prev => ({...prev, client: false}));
        }
    }

    async function loadAssets() {
        const { data } = await supabase
            .from('assets')
            .select('*')
            .order('item');
        
        setAssets(data || []);
    }

    async function loadDocuments() {
        const { data } = await supabase
            .from('documents')
            .select('*')
            .eq('client_id', id)
            .order('created_at', { ascending: false });
        
        setDocuments(data || []);
    }

    async function handleUploadDocument(e: React.FormEvent) {
        e.preventDefault();
        if (!newDocument.file || !id) return;

        setLoading(prev => ({...prev, document: true}));

        try {
            // Upload file to storage
            const fileExt = newDocument.file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `documents/${id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, newDocument.file);

            if (uploadError) throw uploadError;

            // Create document record in database
            const { error: dbError } = await supabase
                .from('documents')
                .insert([{
                    client_id: id,
                    document_type: newDocument.document_type,
                    description: newDocument.description,
                    file_path: filePath,
                    uploaded_by: user?.id
                }]);

            if (dbError) throw dbError;

            // Refresh documents list
            await loadDocuments();
            setShowDocumentModal(false);
            setNewDocument({
                document_type: 'quotation',
                description: '',
                file: null
            });
        } catch (error) {
            console.error('Error uploading document:', error);
        } finally {
            setLoading(prev => ({...prev, document: false}));
        }
    }

    function formatFileSize(bytes: number) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    if (loading.client || !client) return <div>Loading...</div>;

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
                </div>
            </div>

            {/* Contact Persons */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Contact Persons</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {contactPersons.map((contact) => (
                        <div
                            key={contact.id}
                            className="border rounded-lg p-4"
                        >
                            <h3 className="font-semibold text-gray-800">{contact.name}</h3>
                            <p className="text-gray-600 text-sm">{contact.position}</p>
                            <div className="mt-2 space-y-1">
                                <div className="flex items-center text-gray-600 text-sm">
                                    <Mail className="w-4 h-4 mr-2" />
                                    {contact.email}
                                </div>
                                <div className="flex items-center text-gray-600 text-sm">
                                    <Phone className="w-4 h-4 mr-2" />
                                    {contact.phone}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Quotations */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-gray-800">Quotations</h2>
                </div>
                <div className="space-y-4">
                    {quotations.length > 0 ? (
                        quotations.map((quotation) => (
                            <div
                                key={quotation.id}
                                className="border rounded-lg p-4"
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-semibold text-gray-800">
                                            Amount: ${quotation.amount}
                                        </p>
                                        <p className="text-gray-600 text-sm">
                                            By: {quotation.employees?.full_name}
                                        </p>
                                        <p className="text-gray-500 text-sm">
                                            {quotation.description}
                                        </p>
                                        <div className="mt-2">
                                            <p className="text-sm text-gray-600">
                                                Period: {new Date(quotation.start_date).toLocaleDateString()} - {new Date(quotation.end_date).toLocaleDateString()}
                                            </p>
                                        </div>
                                        {quotation.quotation_assets?.length > 0 && (
                                            <div className="mt-2">
                                                <p className="text-sm font-medium text-gray-700">Assets:</p>
                                                <ul className="list-disc list-inside text-sm text-gray-600">
                                                    {quotation.quotation_assets.map((asset: any) => (
                                                        <li key={asset.asset_id}>
                                                            {asset.assets?.item} (Qty: {asset.quantity})
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <span
                                            className={`px-2 py-1 text-xs rounded-full ${
                                                quotation.status === 'approved'
                                                    ? 'bg-green-100 text-green-800'
                                                    : quotation.status === 'rejected'
                                                    ? 'bg-red-100 text-red-800'
                                                    : 'bg-yellow-100 text-yellow-800'
                                            }`}
                                        >
                                            {quotation.status?.charAt(0).toUpperCase() + quotation.status?.slice(1)}
                                        </span>
                                        <span className="text-sm text-gray-500">
                                            {new Date(quotation.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-gray-500">No quotations found</p>
                    )}
                </div>
            </div>

            {/* Site Visits */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-gray-800">Site Visits</h2>
                </div>
                <div className="space-y-4">
                    {siteVisits.length > 0 ? (
                        siteVisits.map((visit) => (
                            <div
                                key={visit.id}
                                className="border rounded-lg p-4"
                            >
                                <div className="flex justify-between">
                                    <div>
                                        <p className="font-semibold text-gray-800">
                                            {visit.address}
                                        </p>
                                        <p className="text-gray-600 text-sm">
                                            By: {visit.employees?.full_name}
                                        </p>
                                        <p className="text-gray-500 text-sm mt-2">
                                            {visit.notes}
                                        </p>
                                        {visit.site_visit_assets?.length > 0 && (
                                            <div className="mt-2">
                                                <p className="text-sm font-medium text-gray-700">Assets Used:</p>
                                                <ul className="list-disc list-inside text-sm text-gray-600">
                                                    {visit.site_visit_assets.map((asset: any) => (
                                                        <li key={asset.asset_id}>
                                                            {asset.assets?.item} (Qty: {asset.quantity})
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        <p className="text-gray-600 text-sm mt-2">
                                            Exit Location: {visit.exit_location}
                                        </p>
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        {new Date(visit.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-gray-500">No site visits found</p>
                    )}
                </div>
            </div>

            {/* Documents */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-gray-800">Documents</h2>
                    <button
                        onClick={() => setShowDocumentModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        <Plus className="w-4 h-4" />
                        Add Document
                    </button>
                </div>
                <div className="space-y-4">
                    {documents.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {documents.map((document) => (
                                <div
                                    key={document.id}
                                    className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                                >
                                    <div className="flex items-start gap-3">
                                        <FileText className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                                        <div className="flex-1">
                                            <h3 className="font-medium text-gray-800">
                                                {document.document_type.charAt(0).toUpperCase() + document.document_type.slice(1)}
                                            </h3>
                                            {document.description && (
                                                <p className="text-gray-600 text-sm mt-1">{document.description}</p>
                                            )}
                                            <p className="text-gray-500 text-xs mt-2">
                                                Uploaded: {new Date(document.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex justify-between items-center">
                                        <span className="text-xs text-gray-500">
                                            {formatFileSize(document.file_size || 0)}
                                        </span>
                                        <a
                                            href={`https://your-supabase-url.supabase.co/storage/v1/object/public/documents/${document.file_path}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                        >
                                            Download
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500">No documents found</p>
                    )}
                </div>
            </div>

            {/* Document Upload Modal */}
            {showDocumentModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">Upload Document</h2>
                        <form onSubmit={handleUploadDocument}>
                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2">Document Type</label>
                                <select
                                    value={newDocument.document_type}
                                    onChange={(e) => setNewDocument({...newDocument, document_type: e.target.value})}
                                    className="w-full p-2 border rounded"
                                    required
                                >
                                    <option value="quotation">Quotation</option>
                                    <option value="contract">Contract</option>
                                    <option value="invoice">Invoice</option>
                                    <option value="proposal">Proposal</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2">Description (Optional)</label>
                                <textarea
                                    value={newDocument.description}
                                    onChange={(e) => setNewDocument({...newDocument, description: e.target.value})}
                                    className="w-full p-2 border rounded"
                                    rows={3}
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2">File</label>
                                <input
                                    type="file"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            setNewDocument({...newDocument, file: e.target.files[0]});
                                        }
                                    }}
                                    className="w-full p-2 border rounded"
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowDocumentModal(false)}
                                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                                    disabled={loading.document}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                    disabled={loading.document || !newDocument.file}
                                >
                                    {loading.document ? 'Uploading...' : 'Upload Document'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}