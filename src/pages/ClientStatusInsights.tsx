import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Calendar, Filter, X } from 'lucide-react';

interface StatusChange {
  id: string;
  client_id: string;
  client_name: string;
  company: string;
  old_status: string;
  new_status: string;
  changed_at: string;
  raw_date: Date;
}

interface StatusDuration {
  from_status: string;
  to_status: string;
  duration: string;
  days: number;
  hours: number;
  minutes: number;
}

export default function ClientStatusInsights() {
  const [statusChanges, setStatusChanges] = useState<StatusChange[]>([]);
  const [statusDurations, setStatusDurations] = useState<Record<string, StatusDuration[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchStatusChanges();
  }, []);

  async function fetchStatusChanges() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('client_status_history')
        .select(`
          id,
          client_id,
          old_status,
          new_status,
          changed_at,
          client:client_id (name, company)
        `)
        .order('changed_at', { ascending: true }); // Changed to ascending for duration calculation

      if (error) throw error;

      const processedData = processStatusData(data || []);
      setStatusChanges(processedData);
      calculateStatusDurations(processedData);
    } catch (error) {
      console.error('Error fetching status changes:', error);
    } finally {
      setLoading(false);
    }
  }

  function processStatusData(rawData: any[]): StatusChange[] {
    return rawData.map(change => {
      return {
        id: change.id,
        client_id: change.client_id,
        client_name: change.client?.name || 'Unknown',
        company: change.client?.company || 'Unknown',
        old_status: change.old_status || 'N/A',
        new_status: change.new_status,
        changed_at: new Date(change.changed_at).toLocaleString(),
        raw_date: new Date(change.changed_at)
      };
    });
  }

  function calculateStatusDurations(changes: StatusChange[]) {
    const clientDurations: Record<string, StatusDuration[]> = {};
    const clientChanges: Record<string, StatusChange[]> = {};

    // Group changes by client
    changes.forEach(change => {
      if (!clientChanges[change.client_id]) {
        clientChanges[change.client_id] = [];
      }
      clientChanges[change.client_id].push(change);
    });

    // Calculate durations for each client
    Object.entries(clientChanges).forEach(([clientId, changes]) => {
      const durations: StatusDuration[] = [];
      
      // Sort changes chronologically
      changes.sort((a, b) => a.raw_date.getTime() - b.raw_date.getTime());

      // Calculate duration between consecutive status changes
      for (let i = 1; i < changes.length; i++) {
        const prevChange = changes[i - 1];
        const currentChange = changes[i];
        
        const timeDiff = currentChange.raw_date.getTime() - prevChange.raw_date.getTime();
        const totalMinutes = Math.floor(timeDiff / (1000 * 60));
        const days = Math.floor(totalMinutes / (60 * 24));
        const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
        const minutes = Math.floor(totalMinutes % 60);

        durations.push({
          from_status: prevChange.new_status,
          to_status: currentChange.new_status,
          duration: formatDuration(days, hours, minutes),
          days,
          hours,
          minutes
        });
      }

      clientDurations[clientId] = durations;
    });

    setStatusDurations(clientDurations);
  }

  function formatDuration(days: number, hours: number, minutes: number): string {
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
    return parts.join(' ');
  }

  const filteredChanges = statusChanges.filter(change => {
    const matchesSearch = 
      change.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      change.company.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDate = dateFilter 
      ? change.raw_date.toISOString().split('T')[0] === dateFilter
      : true;
    
    const matchesStatus = statusFilter 
      ? change.new_status.toLowerCase() === statusFilter.toLowerCase()
      : true;
    
    return matchesSearch && matchesDate && matchesStatus;
  });

  const clearFilters = () => {
    setSearchTerm('');
    setDateFilter('');
    setStatusFilter('');
  };

  const uniqueStatuses = ['ongoing', 'completed', 'poreceived', 'ecomplete'];

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Client Status History</h1>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="w-5 h-5 text-gray-400" />
            </div>
            <input
              type="search"
              placeholder="Search by client or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full p-2 pl-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium">Filters</h3>
            <button 
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:underline flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Clear all
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Change Date</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Calendar className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 p-2"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2"
              >
                <option value="">All Statuses</option>
                {uniqueStatuses.map(status => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status Change</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time Between Statuses</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredChanges.length > 0 ? (
                  filteredChanges.map((change, index, arr) => {
                    // Find the previous change for this client
                    const prevChangeIndex = arr.findIndex(
                      (c, i) => i < index && c.client_id === change.client_id
                    );
                    const prevChange = prevChangeIndex >= 0 ? arr[prevChangeIndex] : null;
                    
                    let duration = 'N/A';
                    if (prevChange) {
                      const timeDiff = change.raw_date.getTime() - prevChange.raw_date.getTime();
                      const totalMinutes = Math.floor(timeDiff / (1000 * 60));
                      const days = Math.floor(totalMinutes / (60 * 24));
                      const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
                      const minutes = Math.floor(totalMinutes % 60);
                      duration = formatDuration(days, hours, minutes);
                    }

                    return (
                      <tr key={`${change.id}-${index}`} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{change.client_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{change.company}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{change.changed_at}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            change.old_status === 'completed' ? 'bg-green-100 text-green-800' :
                            change.old_status === 'ongoing' ? 'bg-blue-100 text-blue-800' :
                            change.old_status === 'poreceived' ? 'bg-purple-100 text-purple-800' :
                            change.old_status === 'ecomplete' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {change.old_status}
                          </span>
                          {' → '}
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            change.new_status === 'completed' ? 'bg-green-100 text-green-800' :
                            change.new_status === 'ongoing' ? 'bg-blue-100 text-blue-800' :
                            change.new_status === 'poreceived' ? 'bg-purple-100 text-purple-800' :
                            change.new_status === 'ecomplete' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {change.new_status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {prevChange ? (
                            <span className={`px-2 py-1 rounded text-xs ${
                              duration === 'N/A' ? 'bg-gray-100 text-gray-800' :
                              getDurationColor(
                                change.raw_date.getTime() - prevChange.raw_date.getTime()
                              )
                            }`}>
                              {duration}
                            </span>
                          ) : 'Initial Status'}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                      No matching status changes found
                      {(searchTerm || dateFilter || statusFilter) && (
                        <button 
                          onClick={clearFilters}
                          className="text-blue-600 hover:underline ml-2"
                        >
                          Clear filters
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function getDurationColor(durationMs: number): string {
  const hours = durationMs / (1000 * 60 * 60);
  if (hours > 72) return 'bg-red-100 text-red-800';
  if (hours > 24) return 'bg-yellow-100 text-yellow-800';
  return 'bg-green-100 text-green-800';
}