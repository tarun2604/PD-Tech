import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { Calendar, Menu, X, Users, MapPin } from 'lucide-react';
import { Calendar as BigCalendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useMediaQuery } from 'react-responsive';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

const localizer = momentLocalizer(moment);

interface NotificationEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  type: 'notification' | 'site_visit';
  description?: string;
  location?: string;
  client?: {
    name: string;
    company: string;
  };
  assignedTo?: string;
  isDelivered?: boolean;
}

interface EmployeeAssignment {
  employee_id: string;
  employee_name: string;
  client_count: number;
}

interface Notification {
  id: string;
  title: string;
  description: string;
  scheduled_at: string;
  created_by: string;
  assigned_to: string;
  is_delivered: boolean;
  created_at: string;
  creator: {
    full_name: string;
  };
}

interface Event {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  type: 'notification' | 'site_visit';
  description?: string;
  location?: string;
  client?: {
    name: string;
    company: string;
  };
}

interface Task {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  type: 'site_visit';
  description?: string;
  status: string;
  client?: {
    name: string;
    company: string;
  };
}

export default function Dashboard() {
  const [calendarEvents, setCalendarEvents] = useState<NotificationEvent[]>([]);
  const [clientCount, setClientCount] = useState<number>(0);
  const [employeeCount, setEmployeeCount] = useState<number>(0);
  const [employeeAssignments, setEmployeeAssignments] = useState<EmployeeAssignment[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [siteVisitCount, setSiteVisitCount] = useState<number>(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [marketingClientCount, setMarketingClientCount] = useState<number>(0);
  const [executionClientCount, setExecutionClientCount] = useState<number>(0);
  const [financeClientCount, setFinanceClientCount] = useState<number>(0);
  const role = useStore((state) => state.role);
  const user = useStore((state) => state.user);
  const navigate = useNavigate();

  const isMobile = useMediaQuery({ maxWidth: 767 });
  const isTablet = useMediaQuery({ minWidth: 768, maxWidth: 1023 });

  useEffect(() => {
    loadCalendarEvents();
    loadClientCount();
    if (role === 'head' || role === 'e.head' || role === 'admin') {
      loadEmployeeCount();
    }
    if (role === 'admin') {
      loadEmployeeAssignments();
      loadAdminClientCounts();
    }
    if (user?.id) {
      loadNotifications();
      loadTasks();
      if (role === 'employee' || role === 'e.employee') {
        loadSiteVisitCount();
      }
    }
  }, [role, user?.id]);

  useEffect(() => {
    if (notifications.length > 0 || tasks.length > 0) {
      const notificationEvents: NotificationEvent[] = notifications.map(notification => ({
        id: notification.id,
        title: notification.title,
        start: new Date(notification.scheduled_at),
        end: new Date(notification.scheduled_at),
        allDay: true,
        type: 'notification' as const,
        description: notification.description,
        assignedTo: notification.assigned_to,
        isDelivered: notification.is_delivered
      }));

      const taskEvents: NotificationEvent[] = tasks.map(task => ({
        id: task.id,
        title: task.title,
        start: task.start,
        end: task.end,
        allDay: task.allDay,
        type: 'site_visit' as const,
        description: task.description,
        client: task.client
      }));

      setEvents([...notificationEvents, ...taskEvents]);
    }
  }, [notifications, tasks]);

  async function loadEmployeeAssignments() {
    try {
      console.log('Loading employee assignments...');
      
      // First get all active employees
      const { data: employees, error: employeesError } = await supabase
        .from('employees')
        .select('id, full_name')
        .eq('is_active', 'true');

      if (employeesError) throw employeesError;
      console.log('Active employees:', employees);

      // Then get all client assignments
      const { data: assignments, error: assignmentsError } = await supabase
        .from('client_assignments')
        .select('employee_id');

      if (assignmentsError) throw assignmentsError;
      console.log('Client assignments:', assignments);

      // Initialize counts for all employees
      const employeeCounts = employees.reduce((acc: { [key: string]: EmployeeAssignment }, employee) => {
        acc[employee.id] = {
          employee_id: employee.id,
          employee_name: employee.full_name,
          client_count: 0
        };
        return acc;
      }, {});

      // Count assignments for each employee
      assignments.forEach(assignment => {
        if (employeeCounts[assignment.employee_id]) {
          employeeCounts[assignment.employee_id].client_count++;
        }
      });

      // Convert to array and sort by client count
      const sortedAssignments = Object.values(employeeCounts)
        .sort((a, b) => b.client_count - a.client_count);

      console.log('Final employee assignments:', sortedAssignments);
      setEmployeeAssignments(sortedAssignments);
    } catch (error) {
      console.error('Error loading employee assignments:', error);
    }
  }

  async function loadEmployeeCount() {
    try {
      const { count, error } = await supabase
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      if (error) throw error;
      setEmployeeCount(count || 0);
    } catch (error) {
      console.error('Error loading employee count:', error);
    }
  }

  async function loadClientCount() {
    try {
      let count = 0;

      switch (role) {
        case 'head':
          // Count clients with ongoing status
          const { count: headCount, error: headError } = await supabase
            .from('clients')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'ongoing');
          if (headError) throw headError;
          count = headCount || 0;
          break;

        case 'e.head':
          // Count clients with perceived status
          const { count: eHeadCount, error: eHeadError } = await supabase
            .from('clients')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'perceived');
          if (eHeadError) throw eHeadError;
          count = eHeadCount || 0;
          break;

        case 'admin':
          // Count clients that are not completed
          const { count: adminCount, error: adminError } = await supabase
            .from('clients')
            .select('*', { count: 'exact', head: true })
            .neq('status', 'completed');
          if (adminError) throw adminError;
          count = adminCount || 0;
          break;

        case 'employee':
          // Count assigned clients + ongoing status
          const { data: employeeAssignments, error: employeeAssignmentsError } = await supabase
            .from('client_assignments')
            .select('client_id')
            .eq('employee_id', user?.id);
          if (employeeAssignmentsError) throw employeeAssignmentsError;

          const { count: employeeOngoingCount, error: employeeOngoingError } = await supabase
            .from('clients')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'ongoing')
            .in('id', employeeAssignments?.map(a => a.client_id) || []);
          if (employeeOngoingError) throw employeeOngoingError;

          count = employeeOngoingCount || 0;
          break;

        case 'e.employee':
          // Count assigned clients + perceived status
          const { data: eEmployeeAssignments, error: eEmployeeAssignmentsError } = await supabase
            .from('client_assignments')
            .select('client_id')
            .eq('employee_id', user?.id);
          if (eEmployeeAssignmentsError) throw eEmployeeAssignmentsError;

          const { count: eEmployeePerceivedCount, error: eEmployeePerceivedError } = await supabase
            .from('clients')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'perceived')
            .in('id', eEmployeeAssignments?.map(a => a.client_id) || []);
          if (eEmployeePerceivedError) throw eEmployeePerceivedError;

          count = eEmployeePerceivedCount || 0;
          break;

        case 'finance.employee':
          // Count clients with ecomplete status
          const { count: financeCount, error: financeError } = await supabase
            .from('clients')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'ecomplete');
          if (financeError) throw financeError;
          count = financeCount || 0;
          break;

        default:
          count = 0;
      }

      setClientCount(count);
    } catch (error) {
      console.error('Error loading client count:', error);
    }
  }

  async function loadCalendarEvents() {
    try {
      // Load calendar events for all roles
      const { data: notifications } = await supabase
        .from('notifications')
        .select('*')
        .order('scheduled_at', { ascending: false })
        .limit(20);

      // Format events for calendar
      const events = (notifications || []).map(notif => ({
        id: notif.id,
        title: notif.title,
        start: new Date(notif.scheduled_at),
        end: new Date(new Date(notif.scheduled_at).getTime() + 60 * 60 * 1000),
        description: notif.description,
        assignedTo: notif.assigned_to,
        isDelivered: notif.is_delivered,
      }));

      setCalendarEvents(events);
    } catch (error) {
      console.error('Error loading calendar events:', error);
    }
  }

  async function loadNotifications() {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          creator:created_by (
            full_name
          )
        `)
        .eq('assigned_to', user?.id)
        .order('scheduled_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  }

  async function loadSiteVisitCount() {
    try {
      const { count, error } = await supabase
        .from('site_visit')
        .select('id', { count: 'exact' })
        .eq('employee_Id', user?.id)
        .eq('status', 'end');

      if (error) throw error;
      setSiteVisitCount(count || 0);
    } catch (error) {
      console.error('Error loading site visit count:', error);
    }
  }

  async function loadTasks() {
    try {
      if (role === 'employee' || role === 'e.employee') {
        // Load site visits for employees
        const { data: siteVisits, error: siteVisitError } = await supabase
          .from('site_visit')
          .select(`
            id,
            client:clients(name, company),
            scheduled_date,
            status,
            description
          `)
          .eq('employee_Id', user?.id)
          .neq('status', 'end');

        if (siteVisitError) throw siteVisitError;

        const taskEvents = siteVisits?.map(visit => ({
          id: visit.id,
          title: `Site Visit: ${visit.client?.company || 'Unknown'}`,
          start: new Date(visit.scheduled_date),
          end: new Date(visit.scheduled_date),
          allDay: true,
          type: 'site_visit' as const,
          description: visit.description,
          client: visit.client,
          status: visit.status
        })) || [];

        setTasks(taskEvents);
      } else if (role === 'head' || role === 'e.head' || role === 'admin') {
        // Load all site visits for heads and admins
        const { data: siteVisits, error: siteVisitError } = await supabase
          .from('site_visit')
          .select(`
            id,
            client:clients(name, company),
            scheduled_date,
            status,
            description
          `)
          .neq('status', 'end');

        if (siteVisitError) throw siteVisitError;

        const taskEvents = siteVisits?.map(visit => ({
          id: visit.id,
          title: `Site Visit: ${visit.client?.company || 'Unknown'}`,
          start: new Date(visit.scheduled_date),
          end: new Date(visit.scheduled_date),
          allDay: true,
          type: 'site_visit' as const,
          description: visit.description,
          client: visit.client,
          status: visit.status
        })) || [];

        setTasks(taskEvents);
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  }

  async function loadAdminClientCounts() {
    try {
      // Marketing clients (ongoing)
      const { count: marketingCount, error: marketingError } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ongoing');
      if (marketingError) throw marketingError;
      setMarketingClientCount(marketingCount || 0);

      // Execution clients (poreceived)
      const { count: executionCount, error: executionError } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'poreceived');
      if (executionError) throw executionError;
      setExecutionClientCount(executionCount || 0);

      // Finance clients (ecomplete)
      const { count: financeCount, error: financeError } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ecomplete');
      if (financeError) throw financeError;
      setFinanceClientCount(financeCount || 0);
    } catch (error) {
      console.error('Error loading admin client counts:', error);
    }
  }

  const eventStyleGetter = (event: NotificationEvent) => {
    let backgroundColor = '#bfdbfe'; // Default blue for future events
    
    if (event.type === 'notification') {
      backgroundColor = event.isDelivered ? '#d1fae5' : '#fee2e2';
    } else if (event.type === 'site_visit') {
      backgroundColor = '#fef3c7'; // Yellow for site visits
    }
    
    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.8,
        color: '#1f2937',
        border: '0px',
        display: 'block',
      },
    };
  };

  const getClientCountTitle = () => {
    switch (role) {
      case 'head':
        return 'Ongoing Clients';
      case 'e.head':
        return 'Perceived Clients';
      case 'admin':
        return 'Active Clients';
      case 'employee':
        return 'Assigned Ongoing Clients';
      case 'e.employee':
        return 'Assigned Perceived Clients';
      case 'finance.employee':
        return 'E-Complete Clients';
      default:
        return 'Clients';
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 p-2 md:p-4">
      {/* Mobile Header */}
      {isMobile && (
        <div className="flex justify-between items-center bg-white p-3 rounded-lg shadow-md sticky top-0 z-10">
          <h1 className="text-xl font-bold text-gray-800">Dashboard</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className="p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Calendar className="w-6 h-6 text-gray-600" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6 text-gray-600" />
              ) : (
                <Menu className="w-6 h-6 text-gray-600" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Desktop Header */}
      {!isMobile && (
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <button
            onClick={() => setShowCalendar(!showCalendar)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Calendar className="w-5 h-5" />
            {showCalendar ? 'Hide Calendar' : 'Show Calendar'}
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Client Count Card */}
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm md:text-base text-gray-500">{getClientCountTitle()}</p>
              <h3 className="text-xl md:text-2xl font-bold text-gray-800">{clientCount}</h3>
            </div>
            <Users className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
          </div>
        </div>

        {/* Admin Client Count Cards */}
        {role === 'admin' && (
          <>
            {/* Marketing Clients Card */}
            <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm md:text-base text-gray-500">Marketing Clients</p>
                  <h3 className="text-xl md:text-2xl font-bold text-gray-800">{marketingClientCount}</h3>
                </div>
                <Users className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
              </div>
            </div>

            {/* Execution Clients Card */}
            <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm md:text-base text-gray-500">Execution Clients</p>
                  <h3 className="text-xl md:text-2xl font-bold text-gray-800">{executionClientCount}</h3>
                </div>
                <Users className="w-6 h-6 md:w-8 md:h-8 text-green-600" />
              </div>
            </div>

            {/* Finance Clients Card */}
            <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm md:text-base text-gray-500">Finance Clients</p>
                  <h3 className="text-xl md:text-2xl font-bold text-gray-800">{financeClientCount}</h3>
                </div>
                <Users className="w-6 h-6 md:w-8 md:h-8 text-purple-600" />
              </div>
            </div>
          </>
        )}

        {/* Employee Count Card - Only for head, e.head, and admin */}
        {(role === 'head' || role === 'e.head' || role === 'admin') && (
          <div 
            className="bg-white rounded-lg shadow-md p-4 md:p-6 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => navigate('/employees')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm md:text-base text-gray-500">Active Employees</p>
                <h3 className="text-xl md:text-2xl font-bold text-gray-800">{employeeCount}</h3>
              </div>
              <Users className="w-6 h-6 md:w-8 md:h-8 text-green-600" />
            </div>
          </div>
        )}

        {/* Site Visit Count Card for Employees */}
        {(role === 'employee' || role === 'e.employee') && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">Completed Site Visits</h2>
                <p className="text-3xl font-bold text-blue-600 mt-2">{siteVisitCount}</p>
              </div>
              <MapPin className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        )}
      </div>

      {/* Employee Assignments Card - Only for admin */}
      {role === 'admin' && (
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Employee Client Assignments</h3>
          <div className="space-y-2">
            {employeeAssignments.map((assignment) => (
              <div 
                key={assignment.employee_id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <span className="font-medium text-gray-700">{assignment.employee_name}</span>
                <span className="font-semibold text-blue-600">{assignment.client_count} clients</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calendar View */}
      {showCalendar && (
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
          <div className="h-[600px] md:h-[700px]">
            <BigCalendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              style={{ height: '100%' }}
              eventPropGetter={eventStyleGetter}
              views={['month', 'week', 'day']}
              defaultView={Views.MONTH}
              popup
              selectable
              onSelectEvent={(event) => {
                if (event.type === 'notification') {
                  navigate(`/notifications/${event.id}`);
                } else if (event.type === 'site_visit') {
                  navigate(`/site-visits/${event.id}`);
                }
              }}
              onSelectSlot={(slotInfo) => {
                navigate('/site-visit/new', {
                  state: {
                    startDate: slotInfo.start,
                    endDate: slotInfo.end
                  }
                });
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}