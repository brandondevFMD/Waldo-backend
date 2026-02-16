// Auth Store - manages user login state

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { authAPI, userAPI } from '../api/client';

export const useAuthStore = create((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  
  // Initialize - check if user is logged in
  initialize: async () => {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (token) {
        const response = await userAPI.getProfile();
        set({ 
          user: response.data, 
          isAuthenticated: true, 
          isLoading: false 
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.log('Init error:', error);
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
      set({ isLoading: false });
    }
  },
  
  // Login
  login: async (email, password) => {
    try {
      const response = await authAPI.login({ email, password });
      const { user, accessToken, refreshToken } = response.data;
      
      await SecureStore.setItemAsync('accessToken', accessToken);
      await SecureStore.setItemAsync('refreshToken', refreshToken);
      
      set({ user, isAuthenticated: true });
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error || 'Login failed';
      return { success: false, error: message };
    }
  },
  
  // Register
  register: async (name, email, password) => {
    try {
      const response = await authAPI.register({ name, email, password });
      const { user, accessToken, refreshToken } = response.data;
      
      await SecureStore.setItemAsync('accessToken', accessToken);
      await SecureStore.setItemAsync('refreshToken', refreshToken);
      
      set({ user, isAuthenticated: true });
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error || 'Registration failed';
      return { success: false, error: message };
    }
  },
  
  // Logout
  logout: async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.log('Logout error:', error);
    }
    
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    set({ user: null, isAuthenticated: false });
  },
  
  // Update user data
  updateUser: (userData) => {
    set({ user: { ...get().user, ...userData } });
  },
}));
