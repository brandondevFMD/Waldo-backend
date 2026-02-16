// Welcome Screen

import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, SIZES } from '../../src/constants/theme';

export default function Welcome() {
  const router = useRouter();
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>🐕</Text>
        <Text style={styles.title}>Waldo</Text>
        <Text style={styles.subtitle}>The Pet Social Network</Text>
      </View>
      
      <View style={styles.features}>
        <FeatureItem icon="🔍" text="Find lost pets in your area" />
        <FeatureItem icon="🐾" text="Create profiles for your pets" />
        <FeatureItem icon="📅" text="Schedule playdates & meetups" />
        <FeatureItem icon="💬" text="Connect with pet lovers" />
        <FeatureItem icon="🏠" text="Adopt from local shelters" />
      </View>
      
      <View style={styles.buttons}>
        <TouchableOpacity 
          style={styles.primaryButton}
          onPress={() => router.push('/(auth)/register')}
        >
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.secondaryButton}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={styles.secondaryButtonText}>I already have an account</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function FeatureItem({ icon, text }) {
  return (
    <View style={styles.featureItem}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SIZES.lg,
  },
  header: {
    alignItems: 'center',
    marginTop: SIZES.xxl,
    marginBottom: SIZES.xl,
  },
  logo: {
    fontSize: 64,
    marginBottom: SIZES.sm,
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  subtitle: {
    fontSize: SIZES.fontMd,
    color: COLORS.textSecondary,
    marginTop: SIZES.xs,
  },
  features: {
    flex: 1,
    justifyContent: 'center',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZES.lg,
  },
  featureIcon: {
    fontSize: 28,
    marginRight: SIZES.md,
  },
  featureText: {
    fontSize: SIZES.fontMd,
    color: COLORS.text,
  },
  buttons: {
    marginBottom: SIZES.xl,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SIZES.md,
    borderRadius: SIZES.radiusMd,
    alignItems: 'center',
    marginBottom: SIZES.md,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: SIZES.fontLg,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: SIZES.md,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontSize: SIZES.fontMd,
    fontWeight: '500',
  },
});
