// Meetups Screen

import { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { meetupAPI } from '../../src/api/client';
import { COLORS, SIZES } from '../../src/constants/theme';

const MEETUP_TYPES = [
  { id: 'all', label: 'All', icon: 'grid' },
  { id: 'PLAYDATE', label: 'Playdates', icon: 'happy' },
  { id: 'GROUP_WALK', label: 'Walks', icon: 'walk' },
  { id: 'PET_EVENT', label: 'Events', icon: 'calendar' },
];

export default function Meetups() {
  const [meetups, setMeetups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedType, setSelectedType] = useState('all');
  
  const loadMeetups = async () => {
    try {
      const params = {};
      if (selectedType !== 'all') params.type = selectedType;
      
      const response = await meetupAPI.search(params);
      setMeetups(response.data.meetups || []);
    } catch (error) {
      console.log('Error loading meetups:', error);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadMeetups();
  }, [selectedType]);
  
  const onRefresh = async () => {
    setRefreshing(true);
    await loadMeetups();
    setRefreshing(false);
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Type Filter */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.typeFilter}
        contentContainerStyle={styles.typeFilterContent}
      >
        {MEETUP_TYPES.map((type) => (
          <TouchableOpacity
            key={type.id}
            style={[
              styles.typeButton,
              selectedType === type.id && styles.typeButtonActive
            ]}
            onPress={() => setSelectedType(type.id)}
          >
            <Ionicons 
              name={type.icon} 
              size={20} 
              color={selectedType === type.id ? '#FFFFFF' : COLORS.textSecondary} 
            />
            <Text style={[
              styles.typeButtonText,
              selectedType === type.id && styles.typeButtonTextActive
            ]}>
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {meetups.length > 0 ? (
          meetups.map((meetup) => (
            <MeetupCard key={meetup.id} meetup={meetup} />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="calendar" size={60} color={COLORS.textLight} />
            <Text style={styles.emptyTitle}>No Meetups Yet</Text>
            <Text style={styles.emptyText}>
              Be the first to organize a meetup in your area!
            </Text>
          </View>
        )}
      </ScrollView>
      
      {/* Create Button */}
      <TouchableOpacity style={styles.createButton}>
        <Ionicons name="add" size={24} color="#FFFFFF" />
        <Text style={styles.createButtonText}>Create Meetup</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function MeetupCard({ meetup }) {
  const date = new Date(meetup.startTime);
  const formattedDate = date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  });
  const formattedTime = date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit' 
  });
  
  const typeColors = {
    PLAYDATE: COLORS.success,
    GROUP_WALK: COLORS.primary,
    PET_EVENT: COLORS.warning,
    TRAINING_SESSION: COLORS.secondary,
    OTHER: COLORS.textSecondary,
  };
  
  return (
    <TouchableOpacity style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={[styles.dateBox, { borderColor: typeColors[meetup.type] }]}>
          <Text style={styles.dateMonth}>
            {date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
          </Text>
          <Text style={styles.dateDay}>{date.getDate()}</Text>
        </View>
      </View>
      
      <View style={styles.cardContent}>
        <View style={[styles.typeBadge, { backgroundColor: typeColors[meetup.type] + '20' }]}>
          <Text style={[styles.typeText, { color: typeColors[meetup.type] }]}>
            {meetup.type.replace('_', ' ')}
          </Text>
        </View>
        
        <Text style={styles.cardTitle}>{meetup.title}</Text>
        
        <View style={styles.cardDetail}>
          <Ionicons name="time-outline" size={14} color={COLORS.textSecondary} />
          <Text style={styles.cardDetailText}>{formattedTime}</Text>
        </View>
        
        <View style={styles.cardDetail}>
          <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
          <Text style={styles.cardDetailText} numberOfLines={1}>
            {meetup.venueName || meetup.address}
          </Text>
        </View>
        
        <View style={styles.cardFooter}>
          <View style={styles.attendees}>
            <Ionicons name="people" size={14} color={COLORS.textSecondary} />
            <Text style={styles.attendeesText}>
              {meetup.attendeeCount || 0} going
            </Text>
          </View>
          
          <TouchableOpacity style={styles.joinButton}>
            <Text style={styles.joinButtonText}>Join</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  typeFilter: {
    maxHeight: 60,
  },
  typeFilterContent: {
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.sm,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    marginRight: SIZES.sm,
    borderRadius: SIZES.radiusFull,
    backgroundColor: COLORS.card,
  },
  typeButtonActive: {
    backgroundColor: COLORS.primary,
  },
  typeButtonText: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    marginLeft: SIZES.xs,
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: SIZES.lg,
    paddingBottom: 100,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: SIZES.radiusLg,
    padding: SIZES.md,
    marginBottom: SIZES.md,
  },
  cardLeft: {
    marginRight: SIZES.md,
  },
  dateBox: {
    width: 56,
    height: 56,
    borderRadius: SIZES.radiusMd,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateMonth: {
    fontSize: SIZES.fontXs,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  dateDay: {
    fontSize: SIZES.fontXl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  cardContent: {
    flex: 1,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SIZES.sm,
    paddingVertical: 2,
    borderRadius: SIZES.radiusSm,
    marginBottom: SIZES.xs,
  },
  typeText: {
    fontSize: SIZES.fontXs,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  cardTitle: {
    fontSize: SIZES.fontMd,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SIZES.xs,
  },
  cardDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardDetailText: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    marginLeft: SIZES.xs,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SIZES.sm,
  },
  attendees: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attendeesText: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    marginLeft: SIZES.xs,
  },
  joinButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.xs,
    borderRadius: SIZES.radiusSm,
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: SIZES.fontSm,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SIZES.xxl,
  },
  emptyTitle: {
    fontSize: SIZES.fontLg,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SIZES.md,
  },
  emptyText: {
    fontSize: SIZES.fontMd,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SIZES.xs,
  },
  createButton: {
    position: 'absolute',
    bottom: SIZES.lg,
    left: SIZES.lg,
    right: SIZES.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SIZES.md,
    borderRadius: SIZES.radiusMd,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: SIZES.fontMd,
    fontWeight: '600',
    marginLeft: SIZES.xs,
  },
});
