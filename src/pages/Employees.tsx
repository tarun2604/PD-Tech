import React, { useState, useEffect } from 'react';
import { Plus, Mail, Phone, Calendar, Search, Edit, Trash2, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logActions } from '../lib/logging';
import { useStore } from '../lib/store';

export default function Employees() {
  const store = useStore();
  const role = store.role;
  const [employees, setEmployees] = useState<any[]>([]);
  const [inactiveEmployees, setInactiveEmployees] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');
  const [newEmployee, setNewEmployee] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'employee',
  });
  const [loading, setLoading] = useState(false);
  const [restoringEmployeeId, setRestoringEmployeeId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredEmployees, setFilteredEmployees] = useState<any[]>([]);
  const [filteredInactiveEmployees, setFilteredInactiveEmployees] = useState<any[]>([]);

  useEffect(() => {
    loadEmployees();
    if (role === 'admin') {
      loadInactiveEmployees();
    }
  }, [role]);

  useEffect(() => {
    filterEmployees();
    filterInactiveEmployees();
  }, [employees, inactiveEmployees, searchQuery]);

  async function loadEmployees() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setEmployees(data || []);
      setFilteredEmployees(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadInactiveEmployees() {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('is_active', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setInactiveEmployees(data || []);
      setFilteredInactiveEmployees(data || []);
    } catch (err: any) {
      console.error('Error loading inactive employees:', err);
    }
  }

  const handleAddEmployee = async (employeeData: any) => {
    try {
      // First, check if an employee with this email already exists
      const { data: existingEmployee, error: checkError } = await supabase
        .from('employees')
        .select('id')
        .eq('email', employeeData.email)
        .maybeSingle();

      if (checkError) throw checkError;
      if (existingEmployee) {
        setError('An employee with this email already exists.');
        return;
      }

      // Create the auth user first
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: employeeData.email,
        password: employeeData.password,
        options: {
          data: {
            full_name: employeeData.full_name,
            role: employeeData.role
          }
        }
      });

      if (authError) throw authError;

      // Then create the employee record
      const { data, error } = await supabase
        .from('employees')
        .insert([{
          full_name: employeeData.full_name,
          email: employeeData.email,
          role: employeeData.role,
          is_active: true
        }])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        // Log the employee addition
        if (store.user?.id) {
          await logActions.employeeAdded(
            store.user.id,
            data.id,
            data.full_name
          );
        }

        // Refresh employees list
        loadEmployees();
        setShowAddModal(false);
        setNewEmployee({
          email: '',
          password: '',
          full_name: '',
          role: 'employee',
        });
      }
    } catch (error) {
      console.error('Error adding employee:', error);
      setError('Failed to add employee. Please try again.');
    }
  };

  const handleUpdateEmployee = async (employeeId: string, updates: any) => {
    try {
      const { error } = await supabase
        .from('employees')
        .update(updates)
        .eq('id', employeeId);

      if (error) throw error;

      // Log the employee update
      if (store.user?.id) {
        await logActions.employeeUpdated(
          store.user.id,
          employeeId,
          updates.full_name || 'Unknown Employee',
          JSON.stringify(updates)
        );
      }

      // Refresh employees list
      loadEmployees();
    } catch (error) {
      console.error('Error updating employee:', error);
    }
  };

  const handleDeactivateEmployee = async (employeeId: string) => {
    try {
      const { error } = await supabase
        .from('employees')
        .update({ is_active: false })
        .eq('id', employeeId);

      if (error) throw error;

      // Log the employee deactivation
      if (store.user?.id) {
        await logActions.employeeDeactivated(
          store.user.id,
          employeeId
        );
      }

      // Refresh employees list
      loadEmployees();
    } catch (error) {
      console.error('Error deactivating employee:', error);
    }
  };

  const handleRestoreEmployee = async (employeeId: string) => {
    setRestoringEmployeeId(employeeId);
    try {
      const { error } = await supabase
        .from('employees')
        .update({ is_active: true })
        .eq('id', employeeId);

      if (error) throw error;

      // Log the employee restoration
      if (store.user?.id) {
        await logActions.employeeRestored(
          store.user.id,
          employeeId
        );
      }

      // Refresh both lists
      loadEmployees();
      loadInactiveEmployees();
    } catch (error) {
      console.error('Error restoring employee:', error);
    } finally {
      setRestoringEmployeeId(null);
    }
  };

  const filterEmployees = () => {
    if (!searchQuery) {
      setFilteredEmployees(employees);
      return;
    }

    const filtered = employees.filter((employee) =>
      employee.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employee.role.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredEmployees(filtered);
  };

  const filterInactiveEmployees = () => {
    if (!searchQuery) {
      setFilteredInactiveEmployees(inactiveEmployees);
      return;
    }

    const filtered = inactiveEmployees.filter((employee) =>
      employee.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employee.role.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredInactiveEmployees(filtered);
  };

  const openEditModal = (employee: any) => {
    setCurrentEmployee(employee);
    setShowEditModal(true);
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Employees</h1>
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search employees..."
              className="pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Employee
          </button>
        </div>
      </div>

      {/* Tab Navigation - Only show for admin */}
      {role === 'admin' && (
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('active')}
              className={`${
                activeTab === 'active'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Active Employees
            </button>
            <button
              onClick={() => setActiveTab('inactive')}
              className={`${
                activeTab === 'inactive'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Inactive Employees
            </button>
          </nav>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded mb-4">
          {error}
        </div>
      )}

      {loading && !filteredEmployees.length ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : role === 'admin' && activeTab === 'inactive' ? (
        filteredInactiveEmployees.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
            <p className="text-gray-500">No inactive employees found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredInactiveEmployees.map((employee) => (
              <div
                key={employee.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow relative"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800">
                      {employee.full_name}
                    </h3>
                    <p className="text-gray-500">{employee.role}</p>
                  </div>
                  <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                    Inactive
                  </span>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center text-gray-600">
                    <Mail className="w-4 h-4 mr-2" />
                    {employee.email}
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Calendar className="w-4 h-4 mr-2" />
                    Joined {new Date(employee.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="mt-4 flex justify-end space-x-2">
                  <button
                    onClick={() => handleRestoreEmployee(employee.id)}
                    className="text-gray-500 hover:text-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Restore"
                    disabled={restoringEmployeeId === employee.id}
                  >
                    {restoringEmployeeId === employee.id ? (
                      <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <UserPlus className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        filteredEmployees.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <p className="text-gray-500">No active employees found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEmployees.map((employee) => (
            <div
              key={employee.id}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow relative"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-800">
                    {employee.full_name}
                  </h3>
                  <p className="text-gray-500">{employee.role}</p>
                </div>
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    employee.role === 'head'
                      ? 'bg-purple-100 text-purple-800'
                    : employee.role === 'admin'
                      ? 'bg-green-100 text-green-800'
                      : employee.role === 'e.head'
                        ? 'bg-orange-100 text-orange-800'
                        : employee.role === 'e.employee'
                          ? 'bg-yellow-100 text-yellow-800'
                          : employee.role === 'finance.employee'
                            ? 'bg-teal-100 text-teal-800'
                          : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {employee.role}
                </span>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center text-gray-600">
                  <Mail className="w-4 h-4 mr-2" />
                  {employee.email}
                </div>
                <div className="flex items-center text-gray-600">
                  <Calendar className="w-4 h-4 mr-2" />
                  Joined {new Date(employee.created_at).toLocaleDateString()}
                </div>
              </div>

              <div className="mt-4 flex justify-end space-x-2">
                <button
                  onClick={() => openEditModal(employee)}
                  className="text-gray-500 hover:text-blue-600"
                  title="Edit"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                    onClick={() => handleDeactivateEmployee(employee.id)}
                  className="text-gray-500 hover:text-red-600"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        )
      )}

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add New Employee</h2>

            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded mb-4">
                {error}
              </div>
            )}

            <form onSubmit={(e) => {
              e.preventDefault();
              handleAddEmployee(newEmployee);
            }}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Full Name</label>
                <input
                  type="text"
                  value={newEmployee.full_name}
                  onChange={(e) =>
                    setNewEmployee({ ...newEmployee, full_name: e.target.value })
                  }
                  className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={newEmployee.email}
                  onChange={(e) =>
                    setNewEmployee({ ...newEmployee, email: e.target.value })
                  }
                  className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Password</label>
                <input
                  type="password"
                  value={newEmployee.password}
                  onChange={(e) =>
                    setNewEmployee({ ...newEmployee, password: e.target.value })
                  }
                  className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  minLength={6}
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Role</label>
                <select
                  value={newEmployee.role}
                  onChange={(e) =>
                    setNewEmployee({ ...newEmployee, role: e.target.value })
                  }
                  className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="employee">Marketing Employee</option>
                  <option value="head">Marketing Head</option>
                  <option value="admin">Admin</option>
                  <option value="e.employee">Execution Employee</option>
                  <option value="e.head">Execution Head</option>
                  <option value="finance.employee">Finance Employee</option>
                </select>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {showEditModal && currentEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Edit Employee</h2>

            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded mb-4">
                {error}
              </div>
            )}

            <form onSubmit={(e) => {
              e.preventDefault();
              handleUpdateEmployee(currentEmployee.id, {
                full_name: currentEmployee.full_name,
                role: currentEmployee.role,
              });
            }}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Full Name</label>
                <input
                  type="text"
                  value={currentEmployee.full_name}
                  onChange={(e) =>
                    setCurrentEmployee({ ...currentEmployee, full_name: e.target.value })
                  }
                  className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={currentEmployee.email}
                  disabled
                  className="w-full p-2 border rounded bg-gray-100 cursor-not-allowed"
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Role</label>
                <select
                  value={currentEmployee.role}
                  onChange={(e) =>
                    setCurrentEmployee({ ...currentEmployee, role: e.target.value })
                  }
                  className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="employee">Marketing Employee</option>
                  <option value="head">Marketing Head</option>
                  <option value="admin">Admin</option>
                  <option value="e.employee">Execution Employee</option>
                  <option value="e.head">Execution Head</option>
                  <option value="finance.employee">Finance Employee</option>
                </select>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}