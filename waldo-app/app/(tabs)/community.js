// Community Screen

import { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { communityAPI } from '../../src/api/client';
import { COLORS, SIZES } from '../../src/constants/theme';

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'QUESTION', label: '❓ Questions' },
  { id: 'ADVICE', label: '💡 Advice' },
  { id: 'HEALTH', label: '🏥 Health' },
  { id: 'TRAINING', label: '🎓 Training' },
  { id: 'STORY', label: '📖 Stories' },
];

export default function Community() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  const loadPosts = async () => {
    try {
      const params = {};
      if (selectedCategory !== 'all') params.category = selectedCategory;
      
      const response = await communityAPI.getPosts(params);
      setPosts(response.data.posts || []);
    } catch (error) {
      console.log('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadPosts();
  }, [selectedCategory]);
  
  const onRefresh = async () => {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Category Filter */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.categoryFilter}
        contentContainerStyle={styles.categoryFilterContent}
      >
        {CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryButton,
              selectedCategory === category.id && styles.categoryButtonActive
            ]}
            onPress={() => setSelectedCategory(category.id)}
          >
            <Text style={[
              styles.categoryButtonText,
              selectedCategory === category.id && styles.categoryButtonTextActive
            ]}>
              {category.label}
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
        {posts.length > 0 ? (
          posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles" size={60} color={COLORS.textLight} />
            <Text style={styles.emptyTitle}>No Posts Yet</Text>
            <Text style={styles.emptyText}>
              Be the first to start a conversation!
            </Text>
          </View>
        )}
      </ScrollView>
      
      {/* Create Post Button */}
      <TouchableOpacity style={styles.createButton}>
        <Ionicons name="create" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function PostCard({ post }) {
  const [liked, setLiked] = useState(post.isLiked);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  
  const handleLike = () => {
    setLiked(!liked);
    setLikesCount(liked ? likesCount - 1 : likesCount + 1);
  };
  
  const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };
  
  const categoryEmoji = {
    GENERAL: '💬',
    ADVICE: '💡',
    QUESTION: '❓',
    HEALTH: '🏥',
    TRAINING: '🎓',
    NUTRITION: '🍎',
    GROOMING: '✨',
    BEHAVIOR: '🧠',
    PRODUCT_REVIEW: '⭐',
    STORY: '📖',
  };
  
  return (
    <TouchableOpacity style={styles.card}>
      {/* Author */}
      <View style={styles.cardHeader}>
        <View style={styles.authorAvatar}>
          {post.author?.avatarUrl ? (
            <Image source={{ uri: post.author.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person" size={20} color={COLORS.textLight} />
          )}
        </View>
        <View style={styles.authorInfo}>
          <Text style={styles.authorName}>{post.author?.name || 'Anonymous'}</Text>
          <Text style={styles.postTime}>{timeAgo(post.createdAt)}</Text>
        </View>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>
            {categoryEmoji[post.category]} {post.category.replace('_', ' ')}
          </Text>
        </View>
      </View>
      
      {/* Content */}
      <Text style={styles.cardContent}>{post.content}</Text>
      
      {/* Images */}
      {post.images?.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
          {post.images.map((uri, index) => (
            <Image key={index} source={{ uri }} style={styles.postImage} />
          ))}
        </ScrollView>
      )}
      
      {/* Actions */}
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
          <Ionicons 
            name={liked ? 'heart' : 'heart-outline'} 
            size={20} 
            color={liked ? COLORS.secondary : COLORS.textSecondary} 
          />
          <Text style={[styles.actionText, liked && { color: COLORS.secondary }]}>
            {likesCount}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="chatbubble-outline" size={20} color={COLORS.textSecondary} />
          <Text style={styles.actionText}>{post.commentsCount}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="share-outline" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  categoryFilter: {
    maxHeight: 50,
  },
  categoryFilterContent: {
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.sm,
  },
  categoryButton: {
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.xs,
    marginRight: SIZES.sm,
    borderRadius: SIZES.radiusFull,
    backgroundColor: COLORS.card,
  },
  categoryButtonActive: {
    backgroundColor: COLORS.primary,
  },
  categoryButtonText: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
  },
  categoryButtonTextActive: {
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
    padding: SIZES.md,
    marginBottom: SIZES.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZES.md,
  },
  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  authorInfo: {
    flex: 1,
    marginLeft: SIZES.sm,
  },
  authorName: {
    fontSize: SIZES.fontMd,
    fontWeight: '500',
    color: COLORS.text,
  },
  postTime: {
    fontSize: SIZES.fontXs,
    color: COLORS.textSecondary,
  },
  categoryBadge: {
    backgroundColor: COLORS.inputBg,
    paddingHorizontal: SIZES.sm,
    paddingVertical: 4,
    borderRadius: SIZES.radiusSm,
  },
  categoryText: {
    fontSize: SIZES.fontXs,
    color: COLORS.textSecondary,
    textTransform: 'capitalize',
  },
  cardContent: {
    fontSize: SIZES.fontMd,
    color: COLORS.text,
    lineHeight: 22,
    marginBottom: SIZES.md,
  },
  imageScroll: {
    marginBottom: SIZES.md,
    marginHorizontal: -SIZES.md,
    paddingHorizontal: SIZES.md,
  },
  postImage: {
    width: 200,
    height: 150,
    borderRadius: SIZES.radiusMd,
    marginRight: SIZES.sm,
  },
  cardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SIZES.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SIZES.lg,
  },
  actionText: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    marginLeft: SIZES.xs,
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
    right: SIZES.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});
