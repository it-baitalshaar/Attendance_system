'use client';

import React, { useState, useEffect } from 'react';
// import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { createSupabbaseFrontendClient } from '@/lib/supabase';
import { useDispatch } from 'react-redux';
import { setDepartment } from '@/redux/slice';

export default function Login() {
  const router = useRouter();
  const dispatch = useDispatch();
  const supabase = createSupabbaseFrontendClient();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  // Check if the user is already logged in
  useEffect(() => {
    const checkSession = async () => {
      setCheckingSession(true);
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const { data: userData } = await supabase.auth.getUser();
        
        if (userData.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('Department, role')
            .eq('id', userData.user.id)
            .single();
            
          if (profile) {
            dispatch(setDepartment(profile.Department));
            
            if (profile.role === 'admin') {
              router.replace('/admin');
            } else {
              router.replace('/');
            }
            return;
          }
        }
      }
      setCheckingSession(false);
    };
    
    checkSession();
    
    // Handle visibility change (when user comes back to the page)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkSession();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await login();
  };

  const login = async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) {
        setErrorMessage(error.message || 'Login failed. Please check your credentials.');
        return;
      }
      
      // Redirect to appropriate page after successful login
      if (data.session) {
        const userId = data.user?.id;

        // Fetch the user's role from the profiles table
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('Department, role')
          .eq('id', userId)
          .single();

        if (profileError) {
          setErrorMessage('Error loading user profile');
          return;
        }

        dispatch(setDepartment(profile?.Department));
        
        // Redirect based on role - use replace instead of push
        if (profile?.role === 'admin') {
          router.replace('/admin');
        } else {
          router.replace('/');
        }
      }
    } catch (error) {
      console.error("An error occurred during login:", error);
      setErrorMessage('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#710D15] border-t-transparent border-solid rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#710D15] flex justify-center items-center mt-[5rem] p-10 rounded-lg">
      <form onSubmit={handleSubmit} className="w-80">
        <h2 className="text-white text-2xl font-bold mb-6 text-center">Login</h2>
        
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {errorMessage}
          </div>
        )}
        
        <div className="mb-3">
          <label htmlFor="email" className="block text-white mb-3">Email</label>
          <input
            className="rounded-lg h-10 w-full px-3"
            type="text"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label htmlFor="Password" className="block text-white mb-3">Password</label>
          <input
            className="rounded-lg h-10 w-full px-3"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
          />
        </div>
        <button 
          type="submit" 
          className="mt-4 bg-white text-black px-4 py-2 rounded-lg w-full"
          disabled={loading}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}
