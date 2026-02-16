// Home Screen

import { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, 
  TouchableOpacity, RefreshControl, Image 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { lostPetAPI, meetupAPI, communityAPI } from '../../src/api/client';
import { COLORS, SIZES } from '../../src/constants/theme';

export default function Home() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [refreshing, setRefreshing] = useState(false);
  const [lostPets, setLostPets] = useState([]);
  const [meetups, setMeetups] = useState([]);
  const [posts, setPosts] = useState([]);
  
  const loadData = async () => {
    try {
      const [lostRes, meetupRes, postRes] = await Promise.all([
        lostPetAPI.search({ limit: 5 }).catch(() => ({ data: { reports: [] } })),
        meetupAPI.search({ limit: 5 }).catch(() => ({ data: { meetups: [] } })),
        communityAPI.getPosts({ limit: 5 }).catch(() => ({ data: { posts: [] } })),
      ]);
      
      setLostPets(lostRes.data.reports || []);
      setMeetups(meetupRes.data.meetups || []);
      setPosts(postRes.data.posts || []);
    } catch (error) {
      console.log('Error loading data:', error);
    }
  };
  
  useEffect(() => {
    loadData();
  }, []);
  
  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0] || 'Friend'}! 👋</Text>
            <Text style={styles.subGreeting}>Welcome to Waldo</Text>
          </View>
          <TouchableOpacity style={styles.notificationBtn}>
            <Ionicons name="notifications-outline" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>
        
        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <QuickAction 
            icon="alert-circle" 
            label="Report Lost" 
            color={COLORS.secondary}
            onPress={() => router.push('/(tabs)/lost')}
          />
          <QuickAction 
            icon="eye" 
            label="I Found a Pet" 
            color={COLORS.success}
            onPress={() => router.push('/(tabs)/lost')}
          />
          <QuickAction 
            icon="calendar" 
            label="New Meetup" 
            color={COLORS.primary}
            onPress={() => router.push('/(tabs)/meetups')}
          />
          <QuickAction 
            icon="paw" 
            label="My Pets" 
            color={COLORS.warning}
            onPress={() => router.push('/(tabs)/profile')}
          />
        </View>
        
        {/* Lost Pets Nearby */}
        <Section 
          title="Lost Pets Nearby" 
          actionText="See All"
          onAction={() => router.push('/(tabs)/lost')}
        >
          {lostPets.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {lostPets.map((pet) => (
                <LostPetCard key={pet.id} pet={pet} />
              ))}
            </ScrollView>
          ) : (
            <EmptyState text="No lost pets in your area" icon="checkmark-circle" />
          )}
        </Section>
        
        {/* Upcoming Meetups */}
        <Section 
          title="Upcoming Meetups" 
          actionText="See All"
          onAction={() => router.push('/(tabs)/meetups')}
        >
          {meetups.length > 0 ? (
            meetups.slice(0, 3).map((meetup) => (
              <MeetupCard key={meetup.id} meetup={meetup} />
            ))
          ) : (
            <EmptyState text="No upcoming meetups" icon="calendar" />
          )}
        </Section>
        
        {/* Community Posts */}
        <Section 
          title="Community" 
          actionText="See All"
          onAction={() => router.push('/(tabs)/community')}
        >
          {posts.length > 0 ? (
            posts.slice(0, 2).map((post) => (
              <PostCard key={post.id} post={post} />
            ))
          ) : (
            <EmptyState text="No posts yet" icon="chatbubbles" />
          )}
        </Section>
        
        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({ icon, label, color, onPress }) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <View style={[styles.quickActionIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function Section({ title, actionText, onAction, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {actionText && (
          <TouchableOpacity onPress={onAction}>
            <Text style={styles.sectionAction}>{actionText}</Text>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}

function LostPetCard({ pet }) {
  return (
    <TouchableOpacity style={styles.lostPetCard}>
      <View style={styles.lostPetImage}>
        {pet.photos?.[0] ? (
          <Image source={{ uri: pet.photos[0] }} style={styles.petImage} />
        ) : (
          <Ionicons name="paw" size={40} color={COLORS.textLight} />
        )}
      </View>
      <Text style={styles.lostPetName}>{pet.petName}</Text>
      <Text style={styles.lostPetBreed}>{pet.breed || pet.species}</Text>
      {pet.rewardAmount && (
        <View style={styles.rewardBadge}>
          <Text style={styles.rewardText}>${pet.rewardAmount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function MeetupCard({ meetup }) {
  return (
    <TouchableOpacity style={styles.meetupCard}>
      <View style={styles.meetupIcon}>
        <Ionicons name="calendar" size={24} color={COLORS.primary} />
      </View>
      <View style={styles.meetupInfo}>
        <Text style={styles.meetupTitle}>{meetup.title}</Text>
        <Text style={styles.meetupDetails}>
          {new Date(meetup.startTime).toLocaleDateString()} • {meetup.address}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
    </TouchableOpacity>
  );
}

function PostCard({ post }) {
  return (
    <TouchableOpacity style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={styles.postAvatar}>
          <Ionicons name="person" size={20} color={COLORS.textLight} />
        </View>
        <Text style={styles.postAuthor}>{post.author?.name}</Text>
      </View>
      <Text style={styles.postContent} numberOfLines={2}>{post.content}</Text>
      <View style={styles.postStats}>
        <Text style={styles.postStat}>❤️ {post.likesCount}</Text>
        <Text style={styles.postStat}>💬 {post.commentsCount}</Text>
      </View>
    </TouchableOpacity>
  );
}

function EmptyState({ text, icon }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name={icon} size={40} color={COLORS.textLight} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.md,
  },
  greeting: {
    fontSize: SIZES.fontXl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  subGreeting: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  notificationBtn: {
    padding: SIZES.sm,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: SIZES.md,
    marginBottom: SIZES.lg,
  },
  quickAction: {
    alignItems: 'center',
    width: 80,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: SIZES.radiusMd,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.xs,
  },
  quickActionLabel: {
    fontSize: SIZES.fontXs,
    color: COLORS.text,
    textAlign: 'center',
  },
  section: {
    marginBottom: SIZES.lg,
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
  sectionAction: {
    fontSize: SIZES.fontSm,
    color: COLORS.primary,
  },
  lostPetCard: {
    width: 140,
    backgroundColor: COLORS.card,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.md,
    marginLeft: SIZES.lg,
    alignItems: 'center',
  },
  lostPetImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
  lostPetName: {
    fontSize: SIZES.fontMd,
    fontWeight: '600',
    color: COLORS.text,
  },
  lostPetBreed: {
    fontSize: SIZES.fontXs,
    color: COLORS.textSecondary,
  },
  rewardBadge: {
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: SIZES.sm,
    paddingVertical: 2,
    borderRadius: SIZES.radiusSm,
    marginTop: SIZES.xs,
  },
  rewardText: {
    fontSize: SIZES.fontXs,
    color: COLORS.success,
    fontWeight: '600',
  },
  meetupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    marginHorizontal: SIZES.lg,
    marginBottom: SIZES.sm,
    padding: SIZES.md,
    borderRadius: SIZES.radiusMd,
  },
  meetupIcon: {
    width: 44,
    height: 44,
    borderRadius: SIZES.radiusSm,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SIZES.md,
  },
  meetupInfo: {
    flex: 1,
  },
  meetupTitle: {
    fontSize: SIZES.fontMd,
    fontWeight: '500',
    color: COLORS.text,
  },
  meetupDetails: {
    fontSize: SIZES.fontXs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  postCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: SIZES.lg,
    marginBottom: SIZES.sm,
    padding: SIZES.md,
    borderRadius: SIZES.radiusMd,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZES.sm,
  },
  postAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SIZES.sm,
  },
  postAuthor: {
    fontSize: SIZES.fontSm,
    fontWeight: '500',
    color: COLORS.text,
  },
  postContent: {
    fontSize: SIZES.fontMd,
    color: COLORS.text,
    marginBottom: SIZES.sm,
  },
  postStats: {
    flexDirection: 'row',
  },
  postStat: {
    fontSize: SIZES.fontXs,
    color: COLORS.textSecondary,
    marginRight: SIZES.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SIZES.xl,
    marginHorizontal: SIZES.lg,
    backgroundColor: COLORS.card,
    borderRadius: SIZES.radiusMd,
  },
  emptyText: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    marginTop: SIZES.sm,
  },
});
