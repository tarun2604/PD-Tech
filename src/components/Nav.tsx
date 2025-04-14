import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { observer } from 'mobx-react-lite';
import { UserCircle, KeyRound, Menu } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { NotificationBell } from './NotificationsBell';

const Nav = observer(() => {
    const store = useStore();
    const navigate = useNavigate();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [employeeData, setEmployeeData] = useState({
        full_name: '',
        role: ''
    });
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [passwordError, setPasswordError] = useState('');

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const fetchEmployeeData = async () => {
            if (store.user?.id) {
                try {
                    const { data, error } = await supabase
                        .from('employees')
                        .select('full_name, role')
                        .eq('id', store.user.id)
                        .single();

                    if (error) throw error;

                    if (data) {
                        setEmployeeData({
                            full_name: data.full_name,
                            role: data.role
                        });
                    }
                } catch (error: any) {
                    console.error('Error fetching employee data:', error);
                }
            }
        };

        fetchEmployeeData();
    }, [store.user?.id]);

    const handleLogout = () => {
        store.logout();
        localStorage.clear();
        sessionStorage.clear();
        navigate('/login');
    };

    const toggleDropdown = () => {
        setIsDropdownOpen(!isDropdownOpen);
        if (isDropdownOpen) {
            setShowChangePassword(false);
        }
    };

    const handlePasswordChange = (e: any) => {
        const { name, value } = e.target;
        setPasswordForm(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleChangePasswordSubmit = async (e: any) => {
        e.preventDefault();
        setPasswordError('');

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setPasswordError("New passwords don't match");
            return;
        }

        if (passwordForm.newPassword.length < 6) {
            setPasswordError("Password must be at least 6 characters");
            return;
        }

        try {
            const { error } = await supabase.auth.updateUser({
                password: passwordForm.newPassword
            });

            if (error) throw error;

            // Reset form and show success
            setPasswordForm({
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            });
            setShowChangePassword(false);
            alert('Password changed successfully!');
        } catch (error: any) {
            console.error('Error changing password:', error);
            setPasswordError(error.message || 'Failed to change password');
        }
    };

    return (
        <nav className="bg-white text-black shadow-lg py-4 px-6 flex items-center justify-between fixed top-0 left-0 right-0 z-50">
            <div className="flex items-center space-x-4">
                <button
                    onClick={() => document.dispatchEvent(new CustomEvent('toggleSidebar'))}
                    className="p-2 hover:bg-gray-100 rounded-md focus:outline-none"
                    aria-label="Toggle Sidebar"
                >
                    <Menu className="w-5 h-5 text-gray-600" />
                </button>
                <p className="text-sm font-medium text-gray-700">{currentTime.toLocaleTimeString()}</p>
            </div>

            <div className="flex items-center space-x-4">
                {store.user?.id && <NotificationBell userId={store.user.id} />}
                <div className="relative">
                    <button
                        onClick={toggleDropdown}
                        className="flex items-center focus:outline-none"
                    >
                        <UserCircle className="w-7 h-7 text-gray-600 hover:text-gray-800" />
                    </button>

                    {isDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-100">
                            {!showChangePassword ? (
                                <>
                                    <div className="px-4 py-2 border-b">
                                        <p className="text-sm font-medium text-gray-700">
                                            {employeeData.full_name || 'Loading...'}
                                        </p>
                                        <p className="text-xs text-gray-500 capitalize">
                                            {employeeData.role.toLowerCase().replace('.', ' • ')}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setShowChangePassword(true)}
                                        className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                        <KeyRound className="w-4 h-4 mr-2" />
                                        Change Password
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                        Logout
                                    </button>
                                </>
                            ) : (
                                <div className="p-3">
                                    <h3 className="text-sm font-medium mb-2">Change Password</h3>
                                    <form onSubmit={handleChangePasswordSubmit}>
                                        <div className="mb-2">
                                            <label className="block text-xs text-gray-500 mb-1">Current Password</label>
                                            <input
                                                type="password"
                                                name="currentPassword"
                                                value={passwordForm.currentPassword}
                                                onChange={handlePasswordChange}
                                                className="w-full px-2 py-1 text-sm border rounded"
                                                required
                                            />
                                        </div>
                                        <div className="mb-2">
                                            <label className="block text-xs text-gray-500 mb-1">New Password</label>
                                            <input
                                                type="password"
                                                name="newPassword"
                                                value={passwordForm.newPassword}
                                                onChange={handlePasswordChange}
                                                className="w-full px-2 py-1 text-sm border rounded"
                                                required
                                            />
                                        </div>
                                        <div className="mb-3">
                                            <label className="block text-xs text-gray-500 mb-1">Confirm Password</label>
                                            <input
                                                type="password"
                                                name="confirmPassword"
                                                value={passwordForm.confirmPassword}
                                                onChange={handlePasswordChange}
                                                className="w-full px-2 py-1 text-sm border rounded"
                                                required
                                            />
                                        </div>
                                        {passwordError && (
                                            <p className="text-xs text-red-500 mb-2">{passwordError}</p>
                                        )}
                                        <div className="flex justify-between">
                                            <button
                                                type="button"
                                                onClick={() => setShowChangePassword(false)}
                                                className="text-xs px-3 py-1 border rounded"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                className="text-xs px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                                            >
                                                Update
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
});

export default Nav;
