// Waldo API Client

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../constants/theme';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.log('Error getting token:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle token refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (refreshToken) {
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            refreshToken,
          });
          
          const { accessToken, refreshToken: newRefreshToken } = response.data;
          
          await SecureStore.setItemAsync('accessToken', accessToken);
          await SecureStore.setItemAsync('refreshToken', newRefreshToken);
          
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Clear tokens and redirect to login
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
      }
    }
    
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  getProfile: () => api.get('/users/profile'),
};

// User API
export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data),
  getUser: (id) => api.get(`/users/${id}`),
  follow: (id) => api.post(`/users/${id}/follow`),
  unfollow: (id) => api.delete(`/users/${id}/follow`),
};

// Pet API
export const petAPI = {
  getMyPets: () => api.get('/pets/my-pets'),
  getPet: (id) => api.get(`/pets/${id}`),
  createPet: (data) => api.post('/pets', data),
  updatePet: (id, data) => api.put(`/pets/${id}`, data),
  deletePet: (id) => api.delete(`/pets/${id}`),
  sendFriendRequest: (petId, fromPetId) => api.post(`/pets/${petId}/friend-request`, { fromPetId }),
  acceptFriend: (petId, friendshipId) => api.post(`/pets/${petId}/accept-friend`, { friendshipId }),
  getFriends: (petId) => api.get(`/pets/${petId}/friends`),
};

// Lost Pet API
export const lostPetAPI = {
  search: (params) => api.get('/lost-pets/search', { params }),
  getReport: (id) => api.get(`/lost-pets/${id}`),
  createReport: (data) => api.post('/lost-pets', data),
  updateStatus: (id, status) => api.patch(`/lost-pets/${id}/status`, { status }),
  getMyReports: () => api.get('/lost-pets/user/my-reports'),
};

// Sighting API
export const sightingAPI = {
  report: (data) => api.post('/sightings', data),
  getNearby: (params) => api.get('/sightings/nearby', { params }),
};

// Meetup API
export const meetupAPI = {
  search: (params) => api.get('/meetups/search', { params }),
  getMeetup: (id) => api.get(`/meetups/${id}`),
  create: (data) => api.post('/meetups', data),
  join: (id, data) => api.post(`/meetups/${id}/join`, data),
  leave: (id) => api.delete(`/meetups/${id}/leave`),
  cancel: (id) => api.delete(`/meetups/${id}`),
  getMyMeetups: () => api.get('/meetups/user/my-meetups'),
};

// Community API
export const communityAPI = {
  getPosts: (params) => api.get('/community/posts', { params }),
  getPost: (id) => api.get(`/community/posts/${id}`),
  createPost: (data) => api.post('/community/posts', data),
  updatePost: (id, data) => api.put(`/community/posts/${id}`, data),
  deletePost: (id) => api.delete(`/community/posts/${id}`),
  likePost: (id) => api.post(`/community/posts/${id}/like`),
  unlikePost: (id) => api.delete(`/community/posts/${id}/like`),
  addComment: (id, data) => api.post(`/community/posts/${id}/comments`, data),
  deleteComment: (id) => api.delete(`/community/comments/${id}`),
  getCategories: () => api.get('/community/categories'),
};

// Marketplace API
export const marketplaceAPI = {
  getListings: (params) => api.get('/marketplace/listings', { params }),
  getListing: (id) => api.get(`/marketplace/listings/${id}`),
  getBusinesses: (params) => api.get('/marketplace/businesses', { params }),
  getBusiness: (id) => api.get(`/marketplace/businesses/${id}`),
  getBusinessTypes: () => api.get('/marketplace/business-types'),
};

// Upload API
export const uploadAPI = {
  uploadImage: async (uri) => {
    const formData = new FormData();
    formData.append('file', {
      uri,
      type: 'image/jpeg',
      name: 'photo.jpg',
    });
    
    return api.post('/uploads/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export default api;
