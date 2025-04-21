import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { FileText, Download} from 'lucide-react';

export default function ClientsHistoryProfile() {
    const { id } = useParams<{ id: string }>();
    const [client, setClient] = useState<any>(null);
    const [contactPersons, setContactPersons] = useState<any[]>([]);
    const [quotations, setQuotations] = useState<any[]>([]);
    const [documents, setDocuments] = useState<any[]>([]);
    const [loading, setLoading] = useState({
        document: false,
        client: true
    });
    const user = useStore((state) => state.user);

    useEffect(() => {
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
            } catch (error) {
                console.error('Error loading client data:', error);
            } finally {
                setLoading(prev => ({...prev, client: false}));
            }
        }

        async function loadDocuments() {
            const { data } = await supabase
                .from('documents')
                .select('*')
                .eq('client_id', id)
                .order('created_at', { ascending: false });
            
            setDocuments(data || []);
        }

        if (id) {
            loadClientData();
            loadDocuments();
        }
    }, [id]);

    function formatFileSize(bytes: number) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    const handleDownloadFile = async (filePath: string, fileName: string) => {
        try {
            const { data, error } = await supabase.storage
                .from('documents')
                .download(filePath);

            if (error) {
                throw error;
            }

            const url = window.URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

        } catch (error: any) {
            console.error('Error downloading file:', error.message);
            alert(`Error downloading file: ${error.message}`);
        }
    };

    if (loading.client || !client) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            {/* Client Header */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">{client?.name}</h1>
                        <p className="text-gray-600">{client?.company}</p>
                        <p className="text-gray-500 mt-2">{client?.address}</p>
                    </div>
                </div>
            </div>

            {/* Contact Persons */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Contact Persons</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {contactPersons?.map((contact) => (
                        <div
                            key={contact.id}
                            className="border rounded-lg p-4"
                        >
                            <h3 className="font-semibold text-gray-800">{contact.name}</h3>
                            <p className="text-gray-600 text-sm">{contact.position}</p>
                            <div className="mt-2 space-y-1">
                                <div className="flex items-center text-gray-600 text-sm">
                                    {contact.email}
                                </div>
                                <div className="flex items-center text-gray-600 text-sm">
                                    {contact.phone}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Quotations */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Quotations</h2>
                <div className="space-y-4">
                    {quotations && quotations.length > 0 ? (
                        quotations.map((quotation) => (
                            <div key={quotation.id} className="border rounded-lg p-4">
                                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                                    <div className="flex-1">
                                        <p className="font-semibold text-gray-800">Amount: ₹{quotation.amount}/-</p>
                                        <p className="text-gray-600 text-sm">By: {quotation.employees?.full_name}</p>
                                        <p className="text-gray-500 text-sm">{quotation.description}</p>
                                        <div className="mt-2">
                                            <p className="text-sm text-gray-600">
                                                Period: {new Date(quotation.start_date).toLocaleDateString()} - {new Date(quotation.end_date).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="mt-2">
                                            <p className="text-sm font-medium text-gray-700">Assets:</p>
                                            <ul className="list-disc list-inside text-sm text-gray-600">
                                                {quotation.quotation_assets?.map((asset: any) => (
                                                    <li key={asset.asset_id}>
                                                        {asset.assets?.item} (Qty: {asset.quantity})
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2 w-full md:w-auto">
                                        <span className={`px-2 py-1 text-xs rounded-full ${
                                            quotation.status === 'approved' ? 'bg-green-100 text-green-800' :
                                            quotation.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                            'bg-yellow-100 text-yellow-800'
                                        }`}>
                                            {quotation.status?.charAt(0).toUpperCase() + quotation.status?.slice(1)}
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

            {/* Documents */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-gray-800">Documents</h2>
                </div>
                <div className="space-y-4">
                    {documents?.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {documents?.map((document: any) => (
                                <div
                                    key={document.id}
                                    className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                                >
                                    <div className="flex items-start gap-3">
                                        <FileText className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                                        <div className="flex-1">
                                            <h3 className="font-medium text-gray-800">
                                                {document.document_type?.charAt(0).toUpperCase() + document.document_type?.slice(1)}
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
                                        <button
                                            onClick={() => handleDownloadFile(document.file_path, document.file_name)}
                                            className="p-2 text-green-600 hover:text-green-800"
                                            title="Download document"
                                            disabled={loading.document}
                                        >
                                            <Download className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500">No documents found</p>
                    )}
                </div>
            </div>
        </div>
    );
}