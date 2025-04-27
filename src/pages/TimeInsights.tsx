import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Calendar, Filter, X, BarChart2, PieChart, Clock, Users, MapPin } from 'lucide-react';

interface TimeInsight {
  id: string;
  client_name: string;
  employee_name: string;
  date: string;
  address: string;
  duration: { days: number; hours: number; minutes: number };
  raw_date: Date;
  status: string;
  form_data?: any;
}

interface TimeAnalysis {
  totalVisits: number;
  averageDuration: number;
  longestVisit: TimeInsight;
  shortestVisit: TimeInsight;
  visitsByEmployee: Record<string, number>;
  visitsByClient: Record<string, number>;
  visitsByLocation: Record<string, number>;
  timeDistribution: {
    lessThanHour: number;
    oneToTwoHours: number;
    twoToFourHours: number;
    moreThanFourHours: number;
  };
}

export default function TimeInsights() {
  const [timeInsights, setTimeInsights] = useState<TimeInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [durationFilter, setDurationFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [timeAnalysis, setTimeAnalysis] = useState<TimeAnalysis | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'analysis' | 'charts'>('list');

  useEffect(() => {
    fetchTimeInsights();
  }, []);

  useEffect(() => {
    if (timeInsights.length > 0) {
      calculateTimeAnalysis();
    }
  }, [timeInsights]);

  async function fetchTimeInsights() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('site_visit')
        .select(`
          id,
          created_at,
          status,
          employee:employee_Id (full_name),
          client:client_Id (name, address),
          form:site_visit_form (
            address,
            created_at,
            notes,
            exit_location
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const processedData = processTimeData(data || []);
      setTimeInsights(processedData);
    } catch (error) {
      console.error('Error fetching time insights:', error);
    } finally {
      setLoading(false);
    }
  }

  function processTimeData(rawData: any[]): TimeInsight[] {
    return rawData
      .filter(visit => visit.status === 'end' && visit.form?.[0]?.created_at)
      .map(visit => {
        const startTime = new Date(visit.created_at);
        const endTime = new Date(visit.form[0].created_at);
        const totalMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
        
        const days = Math.floor(totalMinutes / (60 * 24));
        const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
        const minutes = Math.floor(totalMinutes % 60);
        
        return {
          id: visit.id,
          client_name: visit.client?.name || 'Unknown',
          employee_name: visit.employee?.full_name || 'Unknown',
          date: startTime.toLocaleDateString(),
          raw_date: startTime,
          address: visit.form?.[0]?.address || visit.client?.address || 'N/A',
          duration: { days, hours, minutes },
          status: visit.status,
          form_data: visit.form?.[0]
        };
      });
  }

  function calculateTimeAnalysis() {
    const analysis: TimeAnalysis = {
      totalVisits: timeInsights.length,
      averageDuration: 0,
      longestVisit: timeInsights[0],
      shortestVisit: timeInsights[0],
      visitsByEmployee: {},
      visitsByClient: {},
      visitsByLocation: {},
      timeDistribution: {
        lessThanHour: 0,
        oneToTwoHours: 0,
        twoToFourHours: 0,
        moreThanFourHours: 0
      }
    };

    let totalMinutes = 0;

    timeInsights.forEach(insight => {
      const minutes = insight.duration.days * 1440 + insight.duration.hours * 60 + insight.duration.minutes;
      totalMinutes += minutes;

      // Update longest and shortest visits
      const currentMinutes = insight.duration.days * 1440 + insight.duration.hours * 60 + insight.duration.minutes;
      const longestMinutes = analysis.longestVisit.duration.days * 1440 + 
                            analysis.longestVisit.duration.hours * 60 + 
                            analysis.longestVisit.duration.minutes;
      const shortestMinutes = analysis.shortestVisit.duration.days * 1440 + 
                             analysis.shortestVisit.duration.hours * 60 + 
                             analysis.shortestVisit.duration.minutes;

      if (currentMinutes > longestMinutes) analysis.longestVisit = insight;
      if (currentMinutes < shortestMinutes) analysis.shortestVisit = insight;

      // Count visits by employee
      analysis.visitsByEmployee[insight.employee_name] = 
        (analysis.visitsByEmployee[insight.employee_name] || 0) + 1;

      // Count visits by client
      analysis.visitsByClient[insight.client_name] = 
        (analysis.visitsByClient[insight.client_name] || 0) + 1;

      // Count visits by location
      analysis.visitsByLocation[insight.address] = 
        (analysis.visitsByLocation[insight.address] || 0) + 1;

      // Time distribution
      if (minutes < 60) analysis.timeDistribution.lessThanHour++;
      else if (minutes < 120) analysis.timeDistribution.oneToTwoHours++;
      else if (minutes < 240) analysis.timeDistribution.twoToFourHours++;
      else analysis.timeDistribution.moreThanFourHours++;
    });

    analysis.averageDuration = totalMinutes / timeInsights.length;
    setTimeAnalysis(analysis);
  }

  const filteredInsights = timeInsights.filter(insight => {
    const matchesSearch = 
      insight.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      insight.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      insight.address.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDate = dateFilter 
      ? insight.raw_date.toISOString().split('T')[0] === dateFilter
      : true;
    
    const matchesEmployee = employeeFilter 
      ? insight.employee_name.toLowerCase().includes(employeeFilter.toLowerCase())
      : true;
    
    const matchesClient = clientFilter
      ? insight.client_name.toLowerCase().includes(clientFilter.toLowerCase())
      : true;

    const matchesDuration = durationFilter
      ? {
          'less-than-hour': insight.duration.hours === 0 && insight.duration.days === 0,
          'one-to-two-hours': insight.duration.hours >= 1 && insight.duration.hours < 2 && insight.duration.days === 0,
          'two-to-four-hours': insight.duration.hours >= 2 && insight.duration.hours < 4 && insight.duration.days === 0,
          'more-than-four-hours': insight.duration.hours >= 4 || insight.duration.days > 0
        }[durationFilter]
      : true;
    
    return matchesSearch && matchesDate && matchesEmployee && matchesClient && matchesDuration;
  });

  const clearFilters = () => {
    setSearchTerm('');
    setDateFilter('');
    setEmployeeFilter('');
    setClientFilter('');
    setDurationFilter('');
  };

  const uniqueEmployees = [...new Set(timeInsights.map(insight => insight.employee_name))];
  const uniqueClients = [...new Set(timeInsights.map(insight => insight.client_name))];

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Time Insights</h1>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="w-5 h-5 text-gray-400" />
            </div>
            <input
              type="search"
              placeholder="Search by client, employee or address..."
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Visit Date</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
              <select
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2"
              >
                <option value="">All Employees</option>
                {uniqueEmployees.map(employee => (
                  <option key={employee} value={employee}>{employee}</option>
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
                <option value="less-than-hour">Less than 1 hour</option>
                <option value="one-to-two-hours">1-2 hours</option>
                <option value="two-to-four-hours">2-4 hours</option>
                <option value="more-than-four-hours">More than 4 hours</option>
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredInsights.length > 0 ? (
                      filteredInsights.map(insight => {
                        const totalMinutes = insight.duration.days * 1440 + insight.duration.hours * 60 + insight.duration.minutes;
                        return (
                          <tr key={insight.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{insight.client_name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{insight.employee_name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{insight.date}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{insight.address}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <span
                                className={`px-2 py-1 rounded-full text-xs ${
                                  totalMinutes > 240
                                    ? 'bg-red-100 text-red-800'
                                    : totalMinutes > 120
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-green-100 text-green-800'
                                }`}
                              >
                                {`${insight.duration.days > 0 ? `${insight.duration.days}d ` : ''}${insight.duration.hours}h ${insight.duration.minutes}m`}
                                {totalMinutes > 0 && ` (${totalMinutes.toFixed(0)} mins)`}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {insight.form_data?.notes || 'No notes'}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                          No matching time tracking data found
                          {(searchTerm || dateFilter || employeeFilter || clientFilter || durationFilter) && (
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

          {activeTab === 'analysis' && timeAnalysis && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Overview</h3>
                  <Clock className="w-6 h-6 text-blue-600" />
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-500">Total Visits</p>
                    <p className="text-2xl font-bold text-gray-800">{timeAnalysis.totalVisits}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Average Duration</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {Math.floor(timeAnalysis.averageDuration / 60)}h {Math.floor(timeAnalysis.averageDuration % 60)}m
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Longest Visit</h3>
                  <Calendar className="w-6 h-6 text-red-600" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">Client: {timeAnalysis.longestVisit.client_name}</p>
                  <p className="text-sm text-gray-500">Employee: {timeAnalysis.longestVisit.employee_name}</p>
                  <p className="text-sm text-gray-500">
                    Duration: {timeAnalysis.longestVisit.duration.days}d {timeAnalysis.longestVisit.duration.hours}h {timeAnalysis.longestVisit.duration.minutes}m
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Shortest Visit</h3>
                  <Clock className="w-6 h-6 text-green-600" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">Client: {timeAnalysis.shortestVisit.client_name}</p>
                  <p className="text-sm text-gray-500">Employee: {timeAnalysis.shortestVisit.employee_name}</p>
                  <p className="text-sm text-gray-500">
                    Duration: {timeAnalysis.shortestVisit.duration.days}d {timeAnalysis.shortestVisit.duration.hours}h {timeAnalysis.shortestVisit.duration.minutes}m
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
                    <span className="text-sm text-gray-500">Less than 1 hour</span>
                    <span className="text-sm font-medium text-gray-800">{timeAnalysis.timeDistribution.lessThanHour}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">1-2 hours</span>
                    <span className="text-sm font-medium text-gray-800">{timeAnalysis.timeDistribution.oneToTwoHours}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">2-4 hours</span>
                    <span className="text-sm font-medium text-gray-800">{timeAnalysis.timeDistribution.twoToFourHours}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">More than 4 hours</span>
                    <span className="text-sm font-medium text-gray-800">{timeAnalysis.timeDistribution.moreThanFourHours}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Top Employees</h3>
                  <Users className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="space-y-2">
                  {Object.entries(timeAnalysis.visitsByEmployee)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([employee, count]) => (
                      <div key={employee} className="flex justify-between">
                        <span className="text-sm text-gray-500">{employee}</span>
                        <span className="text-sm font-medium text-gray-800">{count} visits</span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Top Locations</h3>
                  <MapPin className="w-6 h-6 text-red-600" />
                </div>
                <div className="space-y-2">
                  {Object.entries(timeAnalysis.visitsByLocation)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([location, count]) => (
                      <div key={location} className="flex justify-between">
                        <span className="text-sm text-gray-500 truncate">{location}</span>
                        <span className="text-sm font-medium text-gray-800">{count} visits</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'charts' && timeAnalysis && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Time Distribution</h3>
                <div className="space-y-2">
                  {Object.entries(timeAnalysis.timeDistribution).map(([range, count]) => {
                    const percentage = (count / timeAnalysis.totalVisits) * 100;
                    return (
                      <div key={range} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">
                            {range === 'lessThanHour' ? 'Less than 1 hour' :
                             range === 'oneToTwoHours' ? '1-2 hours' :
                             range === 'twoToFourHours' ? '2-4 hours' :
                             'More than 4 hours'}
                          </span>
                          <span className="text-gray-800">{count} visits</span>
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
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Employees</h3>
                <div className="space-y-2">
                  {Object.entries(timeAnalysis.visitsByEmployee)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([employee, count]) => {
                      const percentage = (count / timeAnalysis.totalVisits) * 100;
                      return (
                        <div key={employee} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">{employee}</span>
                            <span className="text-gray-800">{count} visits</span>
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