import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Users,
  Building2,
  LayoutDashboard,
  Bell,
  Clipboard,
  Book,
  Table2Icon,
  Menu,
  Clock,
  FileText,
} from 'lucide-react';
import { useStore } from '../lib/store';

export default function Layout() {
  const { role } = useStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Close sidebar when navigating to a new page
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  // Listen for sidebar toggle event
  useEffect(() => {
    const handleToggleSidebar = () => {
      setIsSidebarOpen(!isSidebarOpen);
    };

    document.addEventListener('toggleSidebar', handleToggleSidebar);
    return () => {
      document.removeEventListener('toggleSidebar', handleToggleSidebar);
    };
  }, [isSidebarOpen]);

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Backdrop - appears when sidebar is open */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 transition-opacity duration-300"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <div 
        className={`w-64 bg-white shadow-lg transition-all duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed top-16 left-0 h-[calc(100vh-4rem)] z-40`}
      >
        <nav className="mt-4">
          {/* Dashboard link is always available */}
          <Link
            to="/dashboard"
            className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-100"
          >
            <LayoutDashboard className="w-5 h-5 mr-3" />
            Dashboard
          </Link>

          {/* Employees link visible for 'head' and 'e.head' roles */}
          {(role === 'head' || role === 'e.head' || role === 'admin') && (
            <Link
              to="/employees"
              className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-100"
            >
              <Users className="w-5 h-5 mr-3" />
              Employees
            </Link>
          )}

          {/* Clients link visible only for 'head', 'admin', and 'employee' roles */}
          {(role === 'head' || role === 'admin' || role === 'employee') && (
            <Link
              to="/clients"
              className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-100"
            >
              <Building2 className="w-5 h-5 mr-3" />
              My Clients
            </Link>
          )}

          {/* EClients link visible only for 'e.employee' role */}
          {(role === 'e.employee' || role === 'e.head') && (
            <Link
              to="/eclients"
              className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-100"
            >
              <Building2 className="w-5 h-5 mr-3" />
              My Clients
            </Link>
          )}

          {/* EClients link visible only for 'e.employee' role */}
          {( role === 'finance.employee') && (
            <Link
              to="/fclients"
              className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-100"
            >
              <Building2 className="w-5 h-5 mr-3" />
              My Clients
            </Link>
          )}

          {/* PD Kits link visible for 'head' */}
          {(role === 'e.head') && (
            <Link
              to="/pd-kits"
              className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-100"
            >
              <Clipboard className="w-5 h-5 mr-3" />
              PD Kits
            </Link>
          )}

          {/* Site Visit link visible for 'employee' and 'e.employee' roles */}
          {(role === 'employee' || role === 'e.employee') && (
            <Link
              to="/site-visit"
              className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-100"
            >
              <Clipboard className="w-5 h-5 mr-3" />
              Site Visit
            </Link>
          )}

          <Link
            to="/allclients"
            className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-100"
          >
            <Table2Icon className="w-5 h-5 mr-3" />
            All Clients
          </Link>

            {(role === 'head' || role === 'e.head' || role === 'admin') && (
            <Link
              to="/time-insights"
              className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-100"
            >
              <Table2Icon className="w-5 h-5 mr-3" />
              Site Visit Time
            </Link>
            )}
            
            {(role === 'head' || role === 'e.head' || role === 'admin') && (
            <Link
              to="/site-time-insights"
              className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-100"
            >
              <Table2Icon className="w-5 h-5 mr-3" />
              Time Report
            </Link>
            )}

          {/* XL Data link */}
          <Link
            to="/xldata"
            className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-100"
          >
            <Table2Icon className="w-5 h-5 mr-3" />
            XL Data
          </Link>


          {/* Notifications link */}
          <Link
            to="/Notifications"
            className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-100"
          >
            <Bell className="w-5 h-5 mr-3" />
            Notifications
          </Link>

          {/* Clients History link */}
          <Link
            to="/clients-history"
            className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-100"
          >
            <Book className="w-5 h-5 mr-3" />
            Clients History
          </Link>

          {/* Logs link visible for admin users only */}
          {role === 'admin' && (
            <Link
              to="/logs"
              className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-100"
            >
              <FileText className="w-5 h-5 mr-3" />
              Logs
            </Link>
          )}

        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto mt-16 transition-all duration-300 ease-in-out">
        <div className="p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
