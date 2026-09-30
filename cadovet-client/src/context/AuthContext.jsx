import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUser = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    const response = await axios.get(`${API_URL}/auth/me`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (response.data.success) {
                        setUser(response.data.data);
                    } else {
                        localStorage.removeItem('token');
                    }
                } catch (error) {
                    console.error('Failed to fetch user', error);
                    localStorage.removeItem('token');
                }
            }
            setLoading(false);
        };
        
        fetchUser();
    }, []);

    const login = async (identifier, password) => {
        const response = await axios.post(`${API_URL}/auth/login`, {
            identifier, password
        });
        
        if (response.data.success) {
            localStorage.setItem('token', response.data.data.token);
            // After successful login, fetch the complete user object (with permissions)
            const meResponse = await axios.get(`${API_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${response.data.data.token}` }
            });
            setUser(meResponse.data.data);
            return true;
        }
        return false;
    };

    // Staff (admin, operational head, doctors, desk staff): email + password. Customers use the OTP methods below.
    const changePassword = async (currentPassword, newPassword) => {
        const token = localStorage.getItem('token');
        const res = await axios.post(`${API_URL}/auth/change-password`,
            { current_password: currentPassword, new_password: newPassword },
            { headers: { Authorization: `Bearer ${token}` } });
        // Every older session ended; keep this one alive with the fresh token.
        await applySession(res.data.data.token);
    };
    const forgotPassword = (email) => axios.post(`${API_URL}/auth/forgot-password`, { identifier: email });
    const resetPassword = (email, code, password) => axios.post(`${API_URL}/auth/reset-password`, { identifier: email, code, password });

    // --- Passwordless customer sign-in / sign-up (same endpoints and rules as the mobile app) -----------------------
    const applySession = async (token) => {
        localStorage.setItem('token', token);
        const me = await axios.get(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        setUser(me.data.data);
    };

    // purpose: 'login' | 'signup'. Rejects with the server's 404 (no account), 409 (already registered), 429 (too many codes).
    const sendOtp = (mobile, purpose, email) =>
        axios.post(`${API_URL}/auth/otp/send`, { mobile, purpose, ...(email ? { email } : {}) });

    const loginWithOtp = async (mobile, code) => {
        const res = await axios.post(`${API_URL}/auth/otp/login`, { mobile, code });
        if (!res.data.success) return false;
        await applySession(res.data.data.token);
        return true;
    };

    const signupWithOtp = async ({ name, mobile, email, code }) => {
        const res = await axios.post(`${API_URL}/auth/otp/signup`, { name, mobile, code, ...(email ? { email } : {}) });
        if (!res.data.success) return false;
        await applySession(res.data.data.token);
        return true;
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
    };

    // Re-pulls /auth/me without touching the token — used after switching the active branch (location isn't part
    // of the JWT, so nothing about the session itself changes, only which desk server-side scoping resolves to).
    const refreshUser = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await axios.get(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.data.success) setUser(res.data.data);
    };

    const hasPermission = (permission) => {
        if (!user || !user.permissions) return false;
        if (user.role_name === 'ADMIN') return true; // Admin has all permissions
        return user.permissions.includes(permission);
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, loading, login, changePassword, forgotPassword, resetPassword, sendOtp, loginWithOtp, signupWithOtp, logout, hasPermission, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => React.useContext(AuthContext);

