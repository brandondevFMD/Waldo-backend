// Waldo App Theme & Constants

export const COLORS = {
  primary: '#6C63FF',      // Purple - main brand color
  secondary: '#FF6B6B',    // Coral - for alerts/lost pets
  success: '#4CAF50',      // Green - for found/success
  warning: '#FFC107',      // Yellow - for warnings
  error: '#F44336',        // Red - for errors
  
  background: '#F8F9FA',   // Light gray background
  card: '#FFFFFF',         // White cards
  text: '#1A1A2E',         // Dark text
  textSecondary: '#6B7280', // Gray text
  textLight: '#9CA3AF',    // Light gray text
  
  border: '#E5E7EB',       // Border color
  inputBg: '#F3F4F6',      // Input background
  
  // Tab bar
  tabActive: '#6C63FF',
  tabInactive: '#9CA3AF',
};

export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
};

export const SIZES = {
  // Spacing
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  
  // Border radius
  radiusSm: 8,
  radiusMd: 12,
  radiusLg: 16,
  radiusFull: 9999,
  
  // Font sizes
  fontXs: 12,
  fontSm: 14,
  fontMd: 16,
  fontLg: 18,
  fontXl: 24,
  fontXxl: 32,
};

export const API_URL = 'https://waldo-backend-production-df9e.up.railway.app/api/v1';

export const PET_SPECIES = [
  { id: 'DOG', label: 'Dog', icon: '🐕' },
  { id: 'CAT', label: 'Cat', icon: '🐈' },
  { id: 'BIRD', label: 'Bird', icon: '🐦' },
  { id: 'RABBIT', label: 'Rabbit', icon: '🐰' },
  { id: 'OTHER', label: 'Other', icon: '🐾' },
];

export const PET_SIZES = [
  { id: 'SMALL', label: 'Small', description: 'Under 20 lbs' },
  { id: 'MEDIUM', label: 'Medium', description: '20-50 lbs' },
  { id: 'LARGE', label: 'Large', description: '50-100 lbs' },
  { id: 'EXTRA_LARGE', label: 'Extra Large', description: 'Over 100 lbs' },
];

export const PET_GENDERS = [
  { id: 'MALE', label: 'Male' },
  { id: 'FEMALE', label: 'Female' },
  { id: 'UNKNOWN', label: 'Unknown' },
];
