// Index Screen - Loading/Redirect

import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/stores/authStore';
import { COLORS, SIZES } from '../src/constants/theme';

export default function Index() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuthStore();
  
  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace('/(tabs)/home');
      } else {
        router.replace('/(auth)/welcome');
      }
    }
  }, [isLoading, isAuthenticated]);
  
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>🐕</Text>
      <Text style={styles.title}>Waldo</Text>
      <Text style={styles.subtitle}>Find Your Best Friend</Text>
      <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  logo: {
    fontSize: 80,
    marginBottom: SIZES.md,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: SIZES.xs,
  },
  subtitle: {
    fontSize: SIZES.fontLg,
    color: 'rgba(255,255,255,0.8)',
  },
  loader: {
    marginTop: SIZES.xl,
  },
});
