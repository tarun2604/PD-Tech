import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Upload, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { logActions } from '../lib/logging';

interface Client {
  id: string;
  name: string;
  company: string;
}

interface SiteVisit {
  id: string;
  client_id: string;
  employee_id: string;
  visit_date: string;
  duration: string;
  notes: string;
  created_at: string;
}

interface NewSiteVisit {
  client_Id: string;
  visit_date: string;
  duration: string;
  notes: string;
}

interface PdKitUpload {
  id: string;
  file_path: string;
  uploaded_at: string;
  upload_type?: string;
}

export default function SiteVisit() {
  const [siteVisits, setSiteVisits] = useState<SiteVisit[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSiteVisits, setFilteredSiteVisits] = useState<SiteVisit[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSiteVisit, setNewSiteVisit] = useState({
    client_Id: '',
    visit_date: '',
    duration: '',
    notes: '',
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [assignedClients, setAssignedClients] = useState<Client[]>([]);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pdKitFile, setPdKitFile] = useState<File | null>(null);
  const [pdKitUploading, setPdKitUploading] = useState(false);
  const [pdKitUploadError, setPdKitUploadError] = useState('');
  const [pdKitUploadSuccess, setPdKitUploadSuccess] = useState('');
  const [currentVisitForPdKit, setCurrentVisitForPdKit] = useState<string | null>(null);
  const [pdKits, setPdKits] = useState<Record<string, PdKitUpload[]>>({});
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const role = useStore((state) => state.role);
  const user = useStore((state) => state.user);

  useEffect(() => {
    loadSiteVisits();
    loadClients();
    if ((role === 'employee' || role === 'e.employee') && user?.id) {
      loadAssignedClients();
    }
  }, [role, user?.id]);

  useEffect(() => {
    filterSiteVisits();
  }, [siteVisits, searchQuery]);

  async function loadSiteVisits() {
    try {
      const { data, error } = await supabase
        .from('site_visit')
        .select('*')
        .eq('status', 'start')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSiteVisits(data || []);

      // Load PD Kits for each visit
      if (data && data.length > 0) {
        const visitIds = data.map(visit => visit.id);
        const { data: pdKitData, error: pdKitError } = await supabase
          .from('pd_kit_uploads')
          .select('*')
          .in('visit_id', visitIds);

        if (pdKitError) throw pdKitError;

        const pdKitsByVisit: Record<string, PdKitUpload[]> = {};
        pdKitData?.forEach(upload => {
          if (upload.visit_id) {
            if (!pdKitsByVisit[upload.visit_id]) {
              pdKitsByVisit[upload.visit_id] = [];
            }
            pdKitsByVisit[upload.visit_id].push(upload);
          }
        });

        setPdKits(pdKitsByVisit);
      }
    } catch (error) {
      console.error('Error loading site visits:', error);
    }
  }

  async function loadClients() {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  }

  async function loadAssignedClients() {
    try {
      if (!user?.id) return;
      
      const { data: assignments, error: assignmentsError } = await supabase
        .from('client_assignments')
        .select('client_id')
        .eq('employee_id', user.id);

      if (assignmentsError) throw assignmentsError;

      if (assignments && assignments.length > 0) {
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('*')
          .in('id', assignments.map(a => a.client_id))
          .order('name');

        if (clientError) throw clientError;
        setAssignedClients(clientData || []);
      }
    } catch (error) {
      console.error('Error loading assigned clients:', error);
    }
  }

  const filterSiteVisits = () => {
    if (!searchQuery) {
      setFilteredSiteVisits(siteVisits);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = siteVisits.filter(visit => {
      const client = (role === 'e.head' || role === 'admin' || role === 'head' ? clients : assignedClients).find(c => c.id === visit.client_id);
      const clientName = client?.name.toLowerCase() || '';
      const companyName = client?.company.toLowerCase() || '';
      
      return (
        clientName.includes(query) ||
        companyName.includes(query) ||
        visit.created_at.toLowerCase().includes(query)
      );
    });
    
    setFilteredSiteVisits(filtered);
  };

  const updateLocation = async () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      return;
    }

    setIsGettingLocation(true);
    setLocationError('');

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
          }
        );
      });

      setNewSiteVisit(prev => ({
        ...prev,
        latitude: position.coords.latitude.toFixed(6),
        longitude: position.coords.longitude.toFixed(6),
        accuracy: `${position.coords.accuracy.toFixed(1)} meters`,
      }));
    } catch (err: any) {
      console.error('Geolocation error:', err);
      setLocationError(err.message || "Failed to get location");
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleCreateSiteVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const { data, error } = await supabase
        .from('site_visits')
        .insert([{
          client_id: newSiteVisit.client_Id,
          employee_id: user?.id,
          visit_date: newSiteVisit.visit_date,
          duration: newSiteVisit.duration,
          notes: newSiteVisit.notes
        }])
        .select()
        .single();

      if (error) throw error;

      // Log the site visit creation
      if (user?.id) {
        const client = clients.find(c => c.id === newSiteVisit.client_Id);
        await logActions.siteVisitCreated(user.id, data.id, client?.name || 'Unknown Client', newSiteVisit.duration);
      }

      setSiteVisits([...siteVisits, data]);
      setShowAddModal(false);
      setNewSiteVisit({
        client_Id: '',
        visit_date: '',
        duration: '',
        notes: ''
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadClick = (visitId: string) => {
    setCurrentVisitForPdKit(visitId);
  };

  const handlePdKitUpload = async (visitId: string, uploadType: 'start' | 'end') => {
    if (!pdKitFile) return;
    setPdKitUploading(true);
    setPdKitUploadError('');
    setPdKitUploadSuccess('');

    try {
      const fileExt = pdKitFile.name.split('.').pop();
      const fileName = `${visitId}_${uploadType}_${Date.now()}.${fileExt}`;
      const filePath = `pd-kits/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('pd-kits')
        .upload(filePath, pdKitFile);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('pd_kits')
        .insert([{
          visit_id: visitId,
          file_path: filePath,
          upload_type: uploadType,
          uploaded_by: user?.id
        }]);

      if (dbError) throw dbError;

      setPdKitUploadSuccess('PD Kit uploaded successfully');
      setPdKitFile(null);
      setTimeout(() => {
        setCurrentVisitForPdKit(null);
        setPdKitUploadSuccess('');
      }, 2000);
    } catch (err) {
      setPdKitUploadError(err instanceof Error ? err.message : 'Failed to upload PD Kit');
    } finally {
      setPdKitUploading(false);
    }
  };

  const getAvailableClients = () => {
    if (role === 'admin' || role === 'e.head' || role === 'head') {
      return clients;
    }
    return assignedClients;
  };

  const getPdKitUrl = (filePath: string) => {
    const { data } = supabase.storage.from('pd-kits').getPublicUrl(filePath);
    return data.publicUrl;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Site Visits</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Site Visit
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search site visits..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Site Visits List */}
      <div className="grid gap-4">
        {filteredSiteVisits.map((visit) => {
          const availableClients = role === 'admin' || role === 'head' ? clients : assignedClients;
          const client = availableClients.find(c => c.id === visit.client_id);
          const visitDate = new Date(visit.created_at).toLocaleString();
          const visitPdKits = pdKits[visit.id] || [];

          return (
            <div key={visit.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold">{client?.name}</h3>
                  <p className="text-gray-600">{client?.company}</p>
                  <p className="text-gray-500 text-sm mt-2">
                    Visit Date: {new Date(visit.visit_date).toLocaleDateString()}
                  </p>
                  <p className="text-gray-500 text-sm">
                    Duration: {visit.duration}
                  </p>
                  {visit.notes && (
                    <p className="text-gray-600 mt-2">{visit.notes}</p>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleUploadClick(visit.id)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <Upload className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Site Visit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Add New Site Visit</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleCreateSiteVisit}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2 font-medium">Client</label>
                <select
                  value={newSiteVisit.client_Id}
                  onChange={(e) => setNewSiteVisit({ ...newSiteVisit, client_Id: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  required
                  disabled={isSubmitting || ((role === 'employee' || role === 'e.employee') && assignedClients.length === 0)}
                >
                  <option value="">Select Client</option>
                  {getAvailableClients().map(client => (
                    <option key={client.id} value={client.id}>
                      {client.name} ({client.company})
                    </option>
                  ))}
                </select>
                {(role === 'employee' || role === 'e.employee') && assignedClients.length === 0 && (
                  <p className="text-red-500 text-sm mt-1">You don't have any assigned clients</p>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 mb-2 font-medium">Visit Date</label>
                <input
                  type="date"
                  value={newSiteVisit.visit_date}
                  onChange={(e) => setNewSiteVisit({ ...newSiteVisit, visit_date: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 mb-2 font-medium">Duration (hours)</label>
                <input
                  type="number"
                  value={newSiteVisit.duration}
                  onChange={(e) => setNewSiteVisit({ ...newSiteVisit, duration: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  required
                  min="0.5"
                  step="0.5"
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 mb-2 font-medium">Notes</label>
                <textarea
                  value={newSiteVisit.notes}
                  onChange={(e) => setNewSiteVisit({ ...newSiteVisit, notes: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}