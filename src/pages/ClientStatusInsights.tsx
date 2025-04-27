import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Calendar, Filter, X, BarChart2, PieChart, Clock, Users, TrendingUp, Activity } from 'lucide-react';

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

interface StatusAnalysis {
  totalChanges: number;
  averageDuration: number;
  longestDuration: StatusDuration;
  shortestDuration: StatusDuration;
  changesByStatus: Record<string, number>;
  changesByClient: Record<string, number>;
  statusTransitions: Record<string, Record<string, number>>;
  timeDistribution: {
    lessThanDay: number;
    oneToThreeDays: number;
    threeToSevenDays: number;
    moreThanWeek: number;
  };
}

export default function ClientStatusInsights() {
  const [statusChanges, setStatusChanges] = useState<StatusChange[]>([]);
  const [statusDurations, setStatusDurations] = useState<Record<string, StatusDuration[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [durationFilter, setDurationFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [statusAnalysis, setStatusAnalysis] = useState<StatusAnalysis | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'analysis' | 'charts'>('list');

  useEffect(() => {
    fetchStatusChanges();
  }, []);

  useEffect(() => {
    if (statusChanges.length > 0) {
      calculateStatusAnalysis();
    }
  }, [statusChanges]);

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
        .order('changed_at', { ascending: true });

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

    changes.forEach(change => {
      if (!clientChanges[change.client_id]) {
        clientChanges[change.client_id] = [];
      }
      clientChanges[change.client_id].push(change);
    });

    Object.entries(clientChanges).forEach(([clientId, changes]) => {
      const durations: StatusDuration[] = [];
      changes.sort((a, b) => a.raw_date.getTime() - b.raw_date.getTime());

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

  function calculateStatusAnalysis() {
    const analysis: StatusAnalysis = {
      totalChanges: statusChanges.length,
      averageDuration: 0,
      longestDuration: { from_status: '', to_status: '', duration: '', days: 0, hours: 0, minutes: 0 },
      shortestDuration: { from_status: '', to_status: '', duration: '', days: 0, hours: 0, minutes: 0 },
      changesByStatus: {},
      changesByClient: {},
      statusTransitions: {},
      timeDistribution: {
        lessThanDay: 0,
        oneToThreeDays: 0,
        threeToSevenDays: 0,
        moreThanWeek: 0
      }
    };

    let totalMinutes = 0;
    let totalDurations = 0;

    // Calculate status transitions and durations
    Object.values(statusDurations).forEach(durations => {
      durations.forEach(duration => {
        const minutes = duration.days * 1440 + duration.hours * 60 + duration.minutes;
        totalMinutes += minutes;
        totalDurations++;

        // Update longest and shortest durations
        if (minutes > (analysis.longestDuration.days * 1440 + analysis.longestDuration.hours * 60 + analysis.longestDuration.minutes)) {
          analysis.longestDuration = duration;
        }
        if (analysis.shortestDuration.duration === '' || minutes < (analysis.shortestDuration.days * 1440 + analysis.shortestDuration.hours * 60 + analysis.shortestDuration.minutes)) {
          analysis.shortestDuration = duration;
        }

        // Count status transitions
        if (!analysis.statusTransitions[duration.from_status]) {
          analysis.statusTransitions[duration.from_status] = {};
        }
        analysis.statusTransitions[duration.from_status][duration.to_status] = 
          (analysis.statusTransitions[duration.from_status][duration.to_status] || 0) + 1;

        // Time distribution
        if (minutes < 1440) analysis.timeDistribution.lessThanDay++;
        else if (minutes < 4320) analysis.timeDistribution.oneToThreeDays++;
        else if (minutes < 10080) analysis.timeDistribution.threeToSevenDays++;
        else analysis.timeDistribution.moreThanWeek++;
      });
    });

    // Count changes by status and client
    statusChanges.forEach(change => {
      analysis.changesByStatus[change.new_status] = (analysis.changesByStatus[change.new_status] || 0) + 1;
      analysis.changesByClient[change.client_name] = (analysis.changesByClient[change.client_name] || 0) + 1;
    });

    analysis.averageDuration = totalMinutes / totalDurations;
    setStatusAnalysis(analysis);
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

    const matchesClient = clientFilter
      ? change.client_name.toLowerCase().includes(clientFilter.toLowerCase())
      : true;

    const matchesDuration = durationFilter
      ? {
          'less-than-day': statusDurations[change.client_id]?.some(d => d.days === 0),
          'one-to-three-days': statusDurations[change.client_id]?.some(d => d.days >= 1 && d.days < 3),
          'three-to-seven-days': statusDurations[change.client_id]?.some(d => d.days >= 3 && d.days < 7),
          'more-than-week': statusDurations[change.client_id]?.some(d => d.days >= 7)
        }[durationFilter]
      : true;
    
    return matchesSearch && matchesDate && matchesStatus && matchesClient && matchesDuration;
  });

  const clearFilters = () => {
    setSearchTerm('');
    setDateFilter('');
    setStatusFilter('');
    setClientFilter('');
    setDurationFilter('');
  };

  const uniqueStatuses = ['ongoing', 'completed', 'poreceived', 'ecomplete'];
  const uniqueClients = [...new Set(statusChanges.map(change => change.client_name))];

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

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'list'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          List View
        </button>
        <button
          onClick={() => setActiveTab('analysis')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'analysis'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Analysis
        </button>
        <button
          onClick={() => setActiveTab('charts')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'charts'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Charts
        </button>
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
              <select
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2"
              >
                <option value="">All Clients</option>
                {uniqueClients.map(client => (
                  <option key={client} value={client}>{client}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
              <select
                value={durationFilter}
                onChange={(e) => setDurationFilter(e.target.value)}
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2"
              >
                <option value="">All Durations</option>
                <option value="less-than-day">Less than 1 day</option>
                <option value="one-to-three-days">1-3 days</option>
                <option value="three-to-seven-days">3-7 days</option>
                <option value="more-than-week">More than 1 week</option>
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
        <>
          {activeTab === 'list' && (
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
                      filteredChanges.map(change => {
                        const durations = statusDurations[change.client_id] || [];
                        const lastDuration = durations[durations.length - 1];
                        return (
                          <tr key={change.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{change.client_name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{change.company}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{change.changed_at}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                                {change.old_status} → {change.new_status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {lastDuration ? (
                                <span
                                  className={`px-2 py-1 rounded-full text-xs ${
                                    lastDuration.days > 7
                                      ? 'bg-red-100 text-red-800'
                                      : lastDuration.days > 3
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-green-100 text-green-800'
                                  }`}
                                >
                                  {lastDuration.duration}
                                </span>
                              ) : (
                                'N/A'
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                          No matching status changes found
                          {(searchTerm || dateFilter || statusFilter || clientFilter || durationFilter) && (
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

          {activeTab === 'analysis' && statusAnalysis && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Overview</h3>
                  <Activity className="w-6 h-6 text-blue-600" />
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-500">Total Status Changes</p>
                    <p className="text-2xl font-bold text-gray-800">{statusAnalysis.totalChanges}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Average Duration</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {Math.floor(statusAnalysis.averageDuration / 1440)}d {Math.floor((statusAnalysis.averageDuration % 1440) / 60)}h
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Longest Duration</h3>
                  <Clock className="w-6 h-6 text-red-600" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">
                    From: {statusAnalysis.longestDuration.from_status}
                  </p>
                  <p className="text-sm text-gray-500">
                    To: {statusAnalysis.longestDuration.to_status}
                  </p>
                  <p className="text-sm text-gray-500">
                    Duration: {statusAnalysis.longestDuration.duration}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Shortest Duration</h3>
                  <Clock className="w-6 h-6 text-green-600" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">
                    From: {statusAnalysis.shortestDuration.from_status}
                  </p>
                  <p className="text-sm text-gray-500">
                    To: {statusAnalysis.shortestDuration.to_status}
                  </p>
                  <p className="text-sm text-gray-500">
                    Duration: {statusAnalysis.shortestDuration.duration}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Time Distribution</h3>
                  <PieChart className="w-6 h-6 text-purple-600" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Less than 1 day</span>
                    <span className="text-sm font-medium text-gray-800">{statusAnalysis.timeDistribution.lessThanDay}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">1-3 days</span>
                    <span className="text-sm font-medium text-gray-800">{statusAnalysis.timeDistribution.oneToThreeDays}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">3-7 days</span>
                    <span className="text-sm font-medium text-gray-800">{statusAnalysis.timeDistribution.threeToSevenDays}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">More than 1 week</span>
                    <span className="text-sm font-medium text-gray-800">{statusAnalysis.timeDistribution.moreThanWeek}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Status Changes</h3>
                  <TrendingUp className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="space-y-2">
                  {Object.entries(statusAnalysis.changesByStatus)
                    .sort(([, a], [, b]) => b - a)
                    .map(([status, count]) => (
                      <div key={status} className="flex justify-between">
                        <span className="text-sm text-gray-500">{status}</span>
                        <span className="text-sm font-medium text-gray-800">{count} changes</span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Top Clients</h3>
                  <Users className="w-6 h-6 text-red-600" />
                </div>
                <div className="space-y-2">
                  {Object.entries(statusAnalysis.changesByClient)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([client, count]) => (
                      <div key={client} className="flex justify-between">
                        <span className="text-sm text-gray-500 truncate">{client}</span>
                        <span className="text-sm font-medium text-gray-800">{count} changes</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'charts' && statusAnalysis && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Time Distribution</h3>
                <div className="space-y-2">
                  {Object.entries(statusAnalysis.timeDistribution).map(([range, count]) => {
                    const percentage = (count / statusAnalysis.totalChanges) * 100;
                    return (
                      <div key={range} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">
                            {range === 'lessThanDay' ? 'Less than 1 day' :
                             range === 'oneToThreeDays' ? '1-3 days' :
                             range === 'threeToSevenDays' ? '3-7 days' :
                             'More than 1 week'}
                          </span>
                          <span className="text-gray-800">{count} changes</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            className="bg-blue-600 h-2.5 rounded-full"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Clients</h3>
                <div className="space-y-2">
                  {Object.entries(statusAnalysis.changesByClient)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([client, count]) => {
                      const percentage = (count / statusAnalysis.totalChanges) * 100;
                      return (
                        <div key={client} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">{client}</span>
                            <span className="text-gray-800">{count} changes</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div
                              className="bg-green-600 h-2.5 rounded-full"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}