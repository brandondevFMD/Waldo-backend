// Profile Screen

import { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { petAPI } from '../../src/api/client';
import { COLORS, SIZES } from '../../src/constants/theme';

export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const loadPets = async () => {
    try {
      const response = await petAPI.getMyPets();
      setPets(response.data || []);
    } catch (error) {
      console.log('Error loading pets:', error);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadPets();
  }, []);
  
  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/welcome');
          }
        },
      ]
    );
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={40} color={COLORS.textLight} />
              </View>
            )}
            <TouchableOpacity style={styles.editAvatarBtn}>
              <Ionicons name="camera" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
          {user?.username && (
            <Text style={styles.userHandle}>@{user.username}</Text>
          )}
          
          <View style={styles.stats}>
            <StatItem value={pets.length} label="Pets" />
            <StatItem value={user?.petsFound || 0} label="Found" />
            <StatItem value={user?.sightingsReported || 0} label="Sightings" />
          </View>
        </View>
        
        {/* My Pets */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Pets</Text>
            {pets.length < 5 && (
              <TouchableOpacity style={styles.addPetBtn}>
                <Ionicons name="add" size={20} color={COLORS.primary} />
                <Text style={styles.addPetText}>Add Pet</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {pets.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {pets.map((pet) => (
                <PetCard key={pet.id} pet={pet} />
              ))}
            </ScrollView>
          ) : (
            <TouchableOpacity style={styles.emptyPetCard}>
              <Ionicons name="paw" size={40} color={COLORS.textLight} />
              <Text style={styles.emptyPetText}>Add your first pet</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* Menu Items */}
        <View style={styles.menu}>
          <MenuItem icon="person-outline" label="Edit Profile" />
          <MenuItem icon="notifications-outline" label="Notifications" />
          <MenuItem icon="heart-outline" label="Saved Posts" />
          <MenuItem icon="time-outline" label="My Reports" />
          <MenuItem icon="card-outline" label="Payment Settings" />
          <MenuItem icon="help-circle-outline" label="Help & Support" />
          <MenuItem icon="settings-outline" label="Settings" />
          <MenuItem 
            icon="log-out-outline" 
            label="Logout" 
            color={COLORS.secondary}
            onPress={handleLogout}
          />
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatItem({ value, label }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function PetCard({ pet }) {
  const speciesEmoji = {
    DOG: '🐕',
    CAT: '🐈',
    BIRD: '🐦',
    RABBIT: '🐰',
    OTHER: '🐾',
  };
  
  return (
    <TouchableOpacity style={styles.petCard}>
      <View style={styles.petImageContainer}>
        {pet.profilePhoto ? (
          <Image source={{ uri: pet.profilePhoto }} style={styles.petImage} />
        ) : (
          <Text style={styles.petEmoji}>{speciesEmoji[pet.species] || '🐾'}</Text>
        )}
      </View>
      <Text style={styles.petName}>{pet.name}</Text>
      <Text style={styles.petBreed}>{pet.breed || pet.species}</Text>
    </TouchableOpacity>
  );
}

function MenuItem({ icon, label, color, onPress }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuItemLeft}>
        <Ionicons name={icon} size={22} color={color || COLORS.text} />
        <Text style={[styles.menuItemLabel, color && { color }]}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    alignItems: 'center',
    paddingVertical: SIZES.xl,
    backgroundColor: COLORS.card,
    borderBottomLeftRadius: SIZES.radiusLg,
    borderBottomRightRadius: SIZES.radiusLg,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: SIZES.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: SIZES.fontXl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  userHandle: {
    fontSize: SIZES.fontMd,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  stats: {
    flexDirection: 'row',
    marginTop: SIZES.lg,
  },
  statItem: {
    alignItems: 'center',
    marginHorizontal: SIZES.lg,
  },
  statValue: {
    fontSize: SIZES.fontXl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
  },
  section: {
    marginTop: SIZES.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.lg,
    marginBottom: SIZES.md,
  },
  sectionTitle: {
    fontSize: SIZES.fontLg,
    fontWeight: '600',
    color: COLORS.text,
  },
  addPetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addPetText: {
    fontSize: SIZES.fontSm,
    color: COLORS.primary,
    marginLeft: 4,
  },
  petCard: {
    width: 120,
    backgroundColor: COLORS.card,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.md,
    marginLeft: SIZES.lg,
    alignItems: 'center',
  },
  petImageContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: COLORS.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.sm,
    overflow: 'hidden',
  },
  petImage: {
    width: '100%',
    height: '100%',
  },
  petEmoji: {
    fontSize: 32,
  },
  petName: {
    fontSize: SIZES.fontMd,
    fontWeight: '600',
    color: COLORS.text,
  },
  petBreed: {
    fontSize: SIZES.fontXs,
    color: COLORS.textSecondary,
  },
  emptyPetCard: {
    marginHorizontal: SIZES.lg,
    backgroundColor: COLORS.card,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.xl,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  emptyPetText: {
    fontSize: SIZES.fontMd,
    color: COLORS.textSecondary,
    marginTop: SIZES.sm,
  },
  menu: {
    marginTop: SIZES.lg,
    backgroundColor: COLORS.card,
    marginHorizontal: SIZES.lg,
    borderRadius: SIZES.radiusLg,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemLabel: {
    fontSize: SIZES.fontMd,
    color: COLORS.text,
    marginLeft: SIZES.md,
  },
});
