// Lost & Found Screen

import { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Image, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { lostPetAPI } from '../../src/api/client';
import { COLORS, SIZES } from '../../src/constants/theme';

export default function Lost() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all, reward, nearby
  
  const loadReports = async () => {
    try {
      const params = {};
      if (filter === 'reward') params.hasReward = true;
      
      const response = await lostPetAPI.search(params);
      setReports(response.data.reports || []);
    } catch (error) {
      console.log('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadReports();
  }, [filter]);
  
  const onRefresh = async () => {
    setRefreshing(true);
    await loadReports();
    setRefreshing(false);
  };
  
  const filteredReports = reports.filter(report => 
    report.petName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    report.breed?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search lost pets..."
            placeholderTextColor={COLORS.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>
      
      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        <FilterTab 
          label="All" 
          active={filter === 'all'} 
          onPress={() => setFilter('all')} 
        />
        <FilterTab 
          label="With Reward" 
          active={filter === 'reward'} 
          onPress={() => setFilter('reward')} 
        />
        <FilterTab 
          label="Nearby" 
          active={filter === 'nearby'} 
          onPress={() => setFilter('nearby')} 
        />
      </View>
      
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {filteredReports.length > 0 ? (
          filteredReports.map((report) => (
            <LostPetCard key={report.id} report={report} />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="paw" size={60} color={COLORS.textLight} />
            <Text style={styles.emptyTitle}>No Lost Pets</Text>
            <Text style={styles.emptyText}>
              Great news! No lost pets in your area right now.
            </Text>
          </View>
        )}
      </ScrollView>
      
      {/* Report Button */}
      <TouchableOpacity style={styles.reportButton}>
        <Ionicons name="add" size={24} color="#FFFFFF" />
        <Text style={styles.reportButtonText}>Report Lost Pet</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function FilterTab({ label, active, onPress }) {
  return (
    <TouchableOpacity 
      style={[styles.filterTab, active && styles.filterTabActive]}
      onPress={onPress}
    >
      <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function LostPetCard({ report }) {
  const daysAgo = Math.floor(
    (new Date() - new Date(report.lastSeenDate)) / (1000 * 60 * 60 * 24)
  );
  
  return (
    <TouchableOpacity style={styles.card}>
      <View style={styles.cardImageContainer}>
        {report.photos?.[0] ? (
          <Image source={{ uri: report.photos[0] }} style={styles.cardImage} />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Ionicons name="paw" size={40} color={COLORS.textLight} />
          </View>
        )}
        {report.rewardAmount && (
          <View style={styles.rewardBadge}>
            <Text style={styles.rewardText}>${report.rewardAmount} Reward</Text>
          </View>
        )}
      </View>
      
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardName}>{report.petName}</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>LOST</Text>
          </View>
        </View>
        
        <Text style={styles.cardBreed}>{report.breed || report.species}</Text>
        
        <View style={styles.cardDetails}>
          <View style={styles.cardDetail}>
            <Ionicons name="location" size={14} color={COLORS.textSecondary} />
            <Text style={styles.cardDetailText} numberOfLines={1}>
              {report.lastSeenAddress}
            </Text>
          </View>
          <View style={styles.cardDetail}>
            <Ionicons name="time" size={14} color={COLORS.textSecondary} />
            <Text style={styles.cardDetailText}>
              {daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`}
            </Text>
          </View>
        </View>
        
        {report.description && (
          <Text style={styles.cardDescription} numberOfLines={2}>
            {report.description}
          </Text>
        )}
        
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="eye" size={18} color={COLORS.primary} />
            <Text style={styles.actionText}>I've Seen This Pet</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareButton}>
            <Ionicons name="share-social" size={18} color={COLORS.textSecondary} />
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
  searchContainer: {
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: SIZES.radiusMd,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
  },
  searchInput: {
    flex: 1,
    marginLeft: SIZES.sm,
    fontSize: SIZES.fontMd,
    color: COLORS.text,
  },
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: SIZES.lg,
    marginBottom: SIZES.md,
  },
  filterTab: {
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    marginRight: SIZES.sm,
    borderRadius: SIZES.radiusFull,
    backgroundColor: COLORS.card,
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
  },
  filterTabText: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
  },
  filterTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: SIZES.lg,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: SIZES.radiusLg,
    marginBottom: SIZES.md,
    overflow: 'hidden',
  },
  cardImageContainer: {
    height: 180,
    backgroundColor: COLORS.inputBg,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rewardBadge: {
    position: 'absolute',
    top: SIZES.sm,
    right: SIZES.sm,
    backgroundColor: COLORS.success,
    paddingHorizontal: SIZES.sm,
    paddingVertical: SIZES.xs,
    borderRadius: SIZES.radiusSm,
  },
  rewardText: {
    color: '#FFFFFF',
    fontSize: SIZES.fontXs,
    fontWeight: '600',
  },
  cardContent: {
    padding: SIZES.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.xs,
  },
  cardName: {
    fontSize: SIZES.fontLg,
    fontWeight: '600',
    color: COLORS.text,
  },
  statusBadge: {
    backgroundColor: COLORS.secondary + '20',
    paddingHorizontal: SIZES.sm,
    paddingVertical: 2,
    borderRadius: SIZES.radiusSm,
  },
  statusText: {
    color: COLORS.secondary,
    fontSize: SIZES.fontXs,
    fontWeight: '600',
  },
  cardBreed: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    marginBottom: SIZES.sm,
  },
  cardDetails: {
    marginBottom: SIZES.sm,
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
  cardDescription: {
    fontSize: SIZES.fontSm,
    color: COLORS.text,
    marginBottom: SIZES.md,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary + '15',
    paddingVertical: SIZES.sm,
    borderRadius: SIZES.radiusSm,
    marginRight: SIZES.sm,
  },
  actionText: {
    color: COLORS.primary,
    fontSize: SIZES.fontSm,
    fontWeight: '500',
    marginLeft: SIZES.xs,
  },
  shareButton: {
    padding: SIZES.sm,
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
  reportButton: {
    position: 'absolute',
    bottom: SIZES.lg,
    left: SIZES.lg,
    right: SIZES.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.secondary,
    paddingVertical: SIZES.md,
    borderRadius: SIZES.radiusMd,
  },
  reportButtonText: {
    color: '#FFFFFF',
    fontSize: SIZES.fontMd,
    fontWeight: '600',
    marginLeft: SIZES.xs,
  },
});
