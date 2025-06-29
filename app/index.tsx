import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, View, TextInput, Alert, Modal as RNModal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import React from 'react';

import { Header } from '@/components/Header';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { DatabaseLoading } from '@/components/DatabaseLoading';
import { ContinueReadingCard } from './components/ContinueReadingCard';
import { useTheme } from '@/contexts/ThemeContext';
import { analytics } from '@/services/analytics';
import { useDatabase } from '@/hooks/useDatabase';
import { 
  getAllSavingsJugs, 
  getSavingsStatistics,
  insertSavingsJug,
  deleteSavingsJug,
  getAllCompletedChapters
} from '@/services/database';
import { 
  addMoneyToJug,
  removeMoneyFromJug
} from '@/services/savingsService';
import { 
  getCurrentReadingStatus,
  startRandomReading,
  isCurrentlyReading,
  getCurrentBookDetails,
  getSmartBookDetails,
  updateReading,
  type CurrentReading,
  type Book
} from '@/services/readingService';
import { QuickReport } from './components/QuickReport';

interface SavingsJug {
  id: number;
  name: string;
  balance: number;
  created: string;
  updated: string;
}

const JUG_EMOJIS = [
  '🐷', // piggy bank
  '💎', // diamond
  '🎯', // target
  '🌈', // rainbow
];


// Gradient palettes
const TOTAL_BALANCE_GRADIENT: [string, string] = ['#fceabb', '#f8b500']; // gold/yellow
const JUG_GRADIENTS: [string, string][] = [
  ['#667eea', '#764ba2'], // blue-purple
  ['#f093fb', '#f5576c'], // pink-orange
  ['#43e97b', '#38f9d7'], // teal-green
  ['#fceabb', '#f8b500'], // yellow-orange
  ['#43cea2', '#185a9d'], // aqua-blue
  ['#ff5858', '#f09819'], // red-orange
  ['#c471f5', '#fa71cd'], // lavender-pink
  ['#30cfd0', '#330867'], // mint-blue
];

export default function HomeScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jugs, setJugs] = useState<SavingsJug[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddMoneyModal, setShowAddMoneyModal] = useState(false);
  const [showRemoveMoneyModal, setShowRemoveMoneyModal] = useState(false);
  const [selectedJug, setSelectedJug] = useState<SavingsJug | null>(null);
  const [showJugLimitModal, setShowJugLimitModal] = useState(false);
  const [currentReading, setCurrentReading] = useState<CurrentReading | null>(null);
  const [isReadingLoading, setIsReadingLoading] = useState(false);
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [smartBookDetails, setSmartBookDetails] = useState<{
    book: Book | null;
    isCompleted: boolean;
    hasNextChapter: boolean;
    nextChapter: Book | null;
  } | null>(null);
  
  // Form states
  const [newJugName, setNewJugName] = useState('');
  const [transactionAmount, setTransactionAmount] = useState('');
  const [transactionName, setTransactionName] = useState('');

  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { isInitialized, isLoading: isDatabaseLoading } = useDatabase();

  // Load savings data
  useEffect(() => {
    if (isInitialized && !isDatabaseLoading) {
      loadSavingsData();
    }
  }, [isInitialized, isDatabaseLoading]);

  // Reload all data when screen comes into focus (e.g., after completing a chapter)
  useFocusEffect(
    React.useCallback(() => {
      if (isInitialized && !isDatabaseLoading) {
        loadSavingsData();
      }
    }, [isInitialized, isDatabaseLoading])
  );

  const loadSavingsData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load all savings jugs
      const allJugs = await getAllSavingsJugs();
      setJugs(allJugs);

      // Load statistics
      const stats = await getSavingsStatistics();
      setStatistics(stats);

      // Load current reading status
      const readingStatus = await getCurrentReadingStatus();
      setCurrentReading(readingStatus);

      // Load smart book details if there's an active reading session
      if (readingStatus) {
        const smartDetails = await getSmartBookDetails();
        setSmartBookDetails(smartDetails);
        
        // Set current book based on smart logic
        if (smartDetails) {
          if (smartDetails.isCompleted && smartDetails.hasNextChapter) {
            // Show next chapter if current is completed
            setCurrentBook(smartDetails.nextChapter);
          } else if (!smartDetails.isCompleted) {
            // Show current chapter if not completed
            setCurrentBook(smartDetails.book);
          } else {
            // Current chapter is completed and no next chapter - don't show continue reading
            setCurrentBook(null);
          }
        } else {
          setCurrentBook(null);
        }
      } else {
        setSmartBookDetails(null);
        setCurrentBook(null);
      }

      // Load all completed chapters
      const completedChapters = await getAllCompletedChapters();
      console.log('=== COMPLETED CHAPTERS LOG ===');
      console.log(`Total completed chapters: ${completedChapters.length}`);
      
      if (completedChapters.length > 0) {
        console.log('Completed chapters details:');
        completedChapters.forEach((chapter, index) => {
          console.log(`${index + 1}. ${chapter.chapter_name} (${chapter.genre}/${chapter.sub_genre})`);
          console.log(`   Book ID: ${chapter.book_id}, Chapter: ${chapter.chapter_number}`);
          console.log(`   Score: ${chapter.score}%, Duration: ${chapter.duration}s, Reading Level: ${chapter.reading_level}`);
          console.log(`   Completed: ${chapter.completed_at}`);
          console.log('---');
        });
        
        // Summary statistics
        const avgScore = completedChapters.reduce((sum, chapter) => sum + chapter.score, 0) / completedChapters.length;
        const totalDuration = completedChapters.reduce((sum, chapter) => sum + chapter.duration, 0);
        const genres = [...new Set(completedChapters.map(chapter => chapter.genre))];
        
        console.log('Summary:');
        console.log(`- Average score: ${avgScore.toFixed(1)}%`);
        console.log(`- Total reading time: ${totalDuration}s (${(totalDuration / 60).toFixed(1)} minutes)`);
        console.log(`- Genres read: ${genres.join(', ')}`);
      } else {
        console.log('No completed chapters found.');
      }
      console.log('=== END COMPLETED CHAPTERS LOG ===');

      setIsLoading(false);
    } catch (error) {
      setError('Failed to load data');
      setIsLoading(false);
      console.error('Error loading data:', error);
    }
  };

  const handleCreateJug = async () => {
    if (!newJugName.trim()) {
      Alert.alert('Error', 'Please enter a jug name');
      return;
    }

    try {
      await insertSavingsJug({ name: newJugName.trim() });
      setNewJugName('');
      setShowAddModal(false);
      await loadSavingsData();
    } catch (error) {
      setError('Failed to create savings jug');
      console.error('Error creating savings jug:', error);
    }
  };

  const handleDeleteJug = async (jug: SavingsJug) => {
    Alert.alert(
      'Delete Savings Jug',
      `Are you sure you want to delete "${jug.name}"? This will also delete all its transactions.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSavingsJug(jug.id);
              await loadSavingsData();
            } catch (error) {
              setError('Failed to delete savings jug');
              console.error('Error deleting savings jug:', error);
            }
          }
        }
      ]
    );
  };

  const handleAddMoney = async () => {
    if (!selectedJug || !transactionAmount || !transactionName.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const amount = parseFloat(transactionAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid positive amount');
      return;
    }

    try {
      await addMoneyToJug(selectedJug.id, amount, transactionName.trim());
      setTransactionAmount('');
      setTransactionName('');
      setSelectedJug(null);
      setShowAddMoneyModal(false);
      await loadSavingsData();
    } catch (error) {
      setError('Failed to add money to jug');
      console.error('Error adding money to jug:', error);
    }
  };

  const handleRemoveMoney = async () => {
    if (!selectedJug || !transactionAmount || !transactionName.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const amount = parseFloat(transactionAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid positive amount');
      return;
    }

    if (selectedJug.balance < amount) {
      Alert.alert('Error', 'Insufficient funds in this jug');
      return;
    }

    try {
      await removeMoneyFromJug(selectedJug.id, amount, transactionName.trim());
      setTransactionAmount('');
      setTransactionName('');
      setSelectedJug(null);
      setShowRemoveMoneyModal(false);
      await loadSavingsData();
    } catch (error) {
      setError('Failed to remove money from jug');
      console.error('Error removing money from jug:', error);
    }
  };

  const handleStartReading = async () => {
    try {
      setIsReadingLoading(true);
      const book = await startRandomReading();
      
      // Track reading start
      analytics.track('reading_started', {
        book_id: book.book_id,
        chapter_name: book.chapter_name,
        genre: book.genre,
        reading_level: book.reading_level
      });
      
      // Update current reading and book details
      const readingStatus = await getCurrentReadingStatus();
      setCurrentReading(readingStatus);
      setCurrentBook(book);
      
      // Navigate to reading screen (you'll need to create this)
      router.push('/reading');
    } catch (error) {
      setError('Failed to start reading');
      console.error('Error starting reading:', error);
    } finally {
      setIsReadingLoading(false);
    }
  };

  const handleContinueReading = async () => {
    try {
      if (!currentReading || !smartBookDetails) {
        setError('No active reading session found');
        return;
      }
      
      setIsReadingLoading(true);
      
      // Determine which book to continue with
      let bookToContinue: Book | null = null;
      
      if (smartBookDetails.isCompleted && smartBookDetails.hasNextChapter) {
        // Continue with next chapter
        bookToContinue = smartBookDetails.nextChapter;
        
        // Update reading progress to next chapter
        if (bookToContinue) {
          await updateReading({
            book_id: bookToContinue.book_id,
            chapter_number: bookToContinue.chapter_number,
            chapter_name: bookToContinue.chapter_name
          });
        }
      } else if (!smartBookDetails.isCompleted) {
        // Continue with current chapter
        bookToContinue = smartBookDetails.book;
      }
      
      if (!bookToContinue) {
        setError('No chapter to continue with');
        return;
      }
      
      // Update current book
      setCurrentBook(bookToContinue);
      
      // Track reading continuation
      analytics.track('reading_continued', {
        book_id: bookToContinue.book_id,
        chapter_name: bookToContinue.chapter_name,
        is_next_chapter: smartBookDetails.isCompleted && smartBookDetails.hasNextChapter
      });
      
      // Navigate to reading screen
      router.push('/reading');
    } catch (error) {
      setError('Failed to continue reading');
      console.error('Error continuing reading:', error);
    } finally {
      setIsReadingLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Track home screen view
  useEffect(() => {
    analytics.track('home_screen_viewed', {
      jugs_count: jugs.length,
      is_loading: isLoading,
      has_error: !!error
    });
  }, [jugs.length, isLoading, error]);

  const handleShareApp = async () => {
    try {
      // Track app sharing
      analytics.track('app_shared', {
        platform: 'home_screen',
        share_method: 'native_share'
      });

      const iosLink = 'https://apps.apple.com/app/dimpo-reads/6742684696';
      const androidLink = 'https://play.google.com/store/apps/details?id=com.dimporeads';
      
      await Share.share({
        message: `Check out this amazing savings app! 💰 Manage your savings goals with our jug system. Track your progress and build better financial habits.\n\nDownload now:\n📱 iOS: ${iosLink}\n🤖 Android: ${androidLink}`,
        title: 'Dimpo Reads App',
      });
    } catch (error) {
      // Error handling for share functionality
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: 20,
      backgroundColor: '#F7F8FA', // soft background
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 40,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      opacity: 0.7,
    },
    titleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    welcomeContainer: {
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    welcomeTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      marginBottom: 12,
      color: colors.text,
      textAlign: 'center',
    },
    welcomeSubtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 32,
      textAlign: 'center',
      lineHeight: 24,
    },
    statsContainer: {
      backgroundColor: colors.surface,
      padding: 20,
      borderRadius: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statsTitle: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 12,
      color: colors.text,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    statsLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    statsValue: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    emptyStateContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
    },
    emptyStateIcon: {
      fontSize: 80,
      marginBottom: 20,
    },
    emptyStateTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 12,
      textAlign: 'center',
      color: colors.text,
    },
    emptyStateText: {
      fontSize: 16,
      textAlign: 'center',
      marginBottom: 40,
      color: colors.textSecondary,
      paddingHorizontal: 20,
    },
    bigButton: {
      backgroundColor: colors.primary,
      paddingVertical: 20,
      paddingHorizontal: 40,
      borderRadius: 16,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 5,
    },
    bigButtonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '600',
    },
    jugsContainer: {
      marginBottom: 20,
    },
    jugsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
      paddingHorizontal: 20,
    },
    jugsTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
    },
    smallButton: {
      backgroundColor: colors.primary,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
      alignItems: 'center',
    },
    smallButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
    jugCard: {
      backgroundColor: isDark ? '#23272f' : '#fff',
      paddingVertical: 22,
      paddingHorizontal: 20,
      borderRadius: 18,
      marginBottom: 18,
      marginHorizontal: 12,
      borderWidth: 1,
      borderColor: isDark ? '#2d3748' : '#e5e7eb',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 2,
      flexDirection: 'column',
    },
    jugHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    jugName: {
      fontSize: 19,
      fontWeight: '700',
      color: colors.text,
      flex: 1,
    },
    jugBalance: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.primary,
      marginLeft: 12,
    },
    deleteIconTouchable: {
      marginLeft: 10,
      padding: 6,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      // subtle hover effect
    },
    jugActionsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
    },
    jugActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 8,
      marginLeft: 0,
      marginRight: 0,
    },
    removeButton: {
      backgroundColor: '#ef4444',
    },
    deleteButton: {
      backgroundColor: '#6b7280',
    },
    jugActionButtonText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '600',
      marginLeft: 2,
    },
    addButton: {
      backgroundColor: '#059669',
    },
    actionButton: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    actionButtonText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: colors.surface,
      padding: 24,
      borderRadius: 16,
      width: '90%',
      maxWidth: 400,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
      marginBottom: 20,
      color: colors.text,
    },
    modalInput: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
      color: colors.text,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    modalButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    modalButtonPrimary: {
      backgroundColor: colors.primary,
    },
    modalButtonSecondary: {
      backgroundColor: colors.border,
    },
    modalButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    modalButtonTextPrimary: {
      color: '#fff',
    },
    modalButtonTextSecondary: {
      color: colors.text,
    },
    errorText: {
      color: '#dc2626',
      fontSize: 16,
      marginBottom: 15,
      textAlign: 'center',
    },
    actionButtonsContainer: {
      gap: 16,
      paddingHorizontal: 20,
      marginBottom: 20,
    },
    mainActionButton: {
      backgroundColor: colors.primary,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 12,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    actionButtonPressed: {
      opacity: 0.8,
      transform: [{ scale: 0.98 }],
    },
    mainActionButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    shareButton: {
      backgroundColor: colors.surface,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 12,
      marginHorizontal: 20,
      marginTop: 20,
      marginBottom: 40,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    shareButtonPressed: {
      opacity: 0.8,
      transform: [{ scale: 0.98 }],
    },
    shareButtonText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    addJugButton: {
      // To use a gradient, wrap the button in a LinearGradient in the render function
      backgroundColor: '#764ba2',
      paddingVertical: 10,
      paddingHorizontal: 22,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 4,
      elevation: 2,
    },
    addJugButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    jugsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginHorizontal: 8,
      marginBottom: 24,
    },
    jugGridCard: {
      width: '48%',
      borderRadius: 20,
      paddingVertical: 18,
      paddingHorizontal: 10,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.10,
      shadowRadius: 12,
      elevation: 4,
      minHeight: 120,
      position: 'relative',
      backgroundColor: '#fff',
      borderWidth: 0,
      marginBottom: 16,
    },
    jugGridPressable: {
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 22,
      paddingVertical: 2,
    },
    jugGridPressed: {
      opacity: 0.7,
      transform: [{ scale: 0.97 }],
    },
    jugGridHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    jugEmoji: {
      fontSize: 36,
      marginRight: 2,
      paddingTop: 14,
    },
    jugGridName: {
      fontSize: 18,
      fontWeight: '700',
      color: '#222',
      marginTop: 6,
      marginBottom: 2,
      textAlign: 'center',
    },
    jugGridBalance: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#3B27C1',
      marginTop: 2,
      textAlign: 'center',
    },
    totalBalanceCard: {
      backgroundColor: '#FDE68A',
      borderRadius: 22,
      paddingVertical: 24,
      paddingHorizontal: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: 10,
      marginBottom: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    totalBalanceEmoji: {
      fontSize: 38,
      marginBottom: 2,
      paddingTop: 10,
    },
    totalBalanceLabel: {
      fontSize: 18,
      fontWeight: '600',
      color: '#7c5c00',
      marginBottom: 4,
    },
    totalBalanceAmount: {
      fontSize: 32,
      fontWeight: 'bold',
      color: '#3B27C1',
      marginTop: 2,
      paddingTop: 10,
    },
    actionButtonDisabled: {
      opacity: 0.5,
    },
    reportButton: {
      backgroundColor: colors.surface,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 12,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      borderWidth: 1,
      borderColor: colors.border,
    },
    reportButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
    },
    reportIcon: {
      marginRight: 12,
    },
    reportTextContainer: {
      flex: 1,
    },
    reportButtonTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    reportButtonSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
    },
  });

  // Show database loading if database is not initialized
  if (!isInitialized || isDatabaseLoading) {
    return <DatabaseLoading message="Loading app..." />;
  }

  return (
    <ScrollView style={{ flex: 1 }}>
      <Header />
      <ThemedView style={styles.container}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <ThemedText style={styles.loadingText}>Loading...</ThemedText>
          </View>
        ) : error ? (
          <ThemedText>{error}</ThemedText>
        ) : (
          <View>
          
            {/* Total Balance Card */}
            <LinearGradient
              colors={TOTAL_BALANCE_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.totalBalanceCard}
            >
              <ThemedText style={styles.totalBalanceEmoji}>💰</ThemedText>
              <ThemedText style={[styles.totalBalanceLabel, { color: '#fff' }]}>Total Balance</ThemedText>
              <ThemedText style={[styles.totalBalanceAmount, { color: '#fff' }]}>{formatCurrency(statistics?.total_balance || 0)}</ThemedText>
            </LinearGradient>

            {/* Empty State or Jugs List */}
            <View style={styles.jugsHeader}>
              <ThemedText style={styles.jugsTitle}>Your Savings Jugs ({jugs.length})</ThemedText>
              <Pressable
                style={styles.addJugButton}
                onPress={() => {
                  if (jugs.length >= 3) {
                    setShowJugLimitModal(true);
                  } else {
                    setShowAddModal(true);
                  }
                }}
              >
                <ThemedText style={styles.addJugButtonText}>＋ Add Jug</ThemedText>
              </Pressable>
            </View>
            {jugs.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <ThemedText style={styles.emptyStateIcon}>🐷</ThemedText>
                <ThemedText style={styles.emptyStateTitle}>No Savings Jugs Yet</ThemedText>
                <ThemedText style={styles.emptyStateText}>
                  Create your first savings jug to start tracking your savings goals. 
                  You can create multiple jugs for different purposes like emergency fund, 
                  vacation, or a new car.
                </ThemedText>
              </View>
            ) : (
              <View style={styles.jugsGrid}>
                {jugs.map((jug, idx) => (
                  <LinearGradient
                    key={jug.id}
                    colors={JUG_GRADIENTS[idx % JUG_GRADIENTS.length]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.jugGridCard}
                  >
                    <Pressable
                      style={({ pressed }) => [styles.jugGridPressable, pressed && styles.jugGridPressed]}
                      android_ripple={{ color: '#e5e7eb' }}
                    >
                      <View style={styles.jugGridHeader}>
                        <ThemedText style={styles.jugEmoji}>{JUG_EMOJIS[idx % JUG_EMOJIS.length]}</ThemedText>
                        <Pressable
                          style={styles.deleteIconTouchable}
                          onPress={() => handleDeleteJug(jug)}
                          accessibilityRole="button"
                          accessibilityLabel={`Delete ${jug.name}`}
                        >
                          <Ionicons name="trash-outline" size={20} color="#fff" />
                        </Pressable>
                      </View>
                      <ThemedText style={[styles.jugGridName, { color: '#fff' }]}>{jug.name}</ThemedText>
                      <ThemedText style={[styles.jugGridBalance, { color: '#fff' }]}>{formatCurrency(jug.balance)}</ThemedText>
                    </Pressable>
                  </LinearGradient>
                ))}
              </View>
            )}

            {/* Other Action Buttons */}
            <View style={styles.actionButtonsContainer}>
              {/* Continue Reading Card or Start New Book Card */}
              {currentReading && smartBookDetails ? (
                // Show continue reading card if there's a chapter to continue with
                currentBook ? (
                  <ContinueReadingCard
                    book={{ ...currentBook, images: require('../assets/images/book/story_1_7-10_ch1_img1_1751219215.png') }}
                    onPress={handleContinueReading}
                    isLoading={isReadingLoading}
                    isNextChapter={smartBookDetails.isCompleted && smartBookDetails.hasNextChapter}
                  />
                ) : (
                  // Show start new book card if current chapter is completed and no next chapter
                  <Pressable
                    style={({ pressed }) => [
                      styles.mainActionButton,
                      pressed && styles.actionButtonPressed,
                      isReadingLoading && styles.actionButtonDisabled,
                    ]}
                    onPress={handleStartReading}
                    disabled={isReadingLoading}
                    accessibilityRole="button"
                    accessibilityLabel="Start new book"
                  >
                    <ThemedText style={styles.mainActionButtonText}>
                      {isReadingLoading ? '⏳ Loading...' : '📖 Start New Book'}
                    </ThemedText>
                  </Pressable>
                )
              ) : (
                // Show start reading card if no active reading session
                <Pressable
                  style={({ pressed }) => [
                    styles.mainActionButton,
                    pressed && styles.actionButtonPressed,
                    isReadingLoading && styles.actionButtonDisabled,
                  ]}
                  onPress={handleStartReading}
                  disabled={isReadingLoading}
                  accessibilityRole="button"
                  accessibilityLabel="Start reading"
                >
                  <ThemedText style={styles.mainActionButtonText}>
                    {isReadingLoading ? '⏳ Loading...' : '📖 Start Reading'}
                  </ThemedText>
                </Pressable>
              )}

              {/* Report Button */}
              <QuickReport booksRead={12} totalEarned={45.75} minutesRead={1830} />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.shareButton,
                pressed && styles.shareButtonPressed,
              ]}
              onPress={handleShareApp}
              accessibilityRole="button"
              accessibilityLabel="Share app"
            >
              <ThemedText style={styles.shareButtonText}>
                🔗 Invite Friends
              </ThemedText>
            </Pressable>
          </View>
        )}
      </ThemedView>

      {/* Add Jug Modal */}
      <RNModal visible={showAddModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Create New Savings Jug</ThemedText>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter jug name..."
              placeholderTextColor={colors.textSecondary}
              value={newJugName}
              onChangeText={setNewJugName}
            />
            <View style={styles.modalButtons}>
              <Pressable 
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => {
                  setShowAddModal(false);
                  setNewJugName('');
                }}
              >
                <ThemedText style={[styles.modalButtonText, styles.modalButtonTextSecondary]}>Cancel</ThemedText>
              </Pressable>
              <Pressable 
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleCreateJug}
              >
                <ThemedText style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>Create</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </RNModal>

      {/* Add Money Modal */}
      <RNModal visible={showAddMoneyModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>
              Add Money to {selectedJug?.name}
            </ThemedText>
            <TextInput
              style={styles.modalInput}
              placeholder="Amount..."
              placeholderTextColor={colors.textSecondary}
              value={transactionAmount}
              onChangeText={setTransactionAmount}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Transaction name (e.g., Monthly deposit)"
              placeholderTextColor={colors.textSecondary}
              value={transactionName}
              onChangeText={setTransactionName}
            />
            <View style={styles.modalButtons}>
              <Pressable 
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => {
                  setShowAddMoneyModal(false);
                  setTransactionAmount('');
                  setTransactionName('');
                  setSelectedJug(null);
                }}
              >
                <ThemedText style={[styles.modalButtonText, styles.modalButtonTextSecondary]}>Cancel</ThemedText>
              </Pressable>
              <Pressable 
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleAddMoney}
              >
                <ThemedText style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>Add Money</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </RNModal>

      {/* Remove Money Modal */}
      <RNModal visible={showRemoveMoneyModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>
              Remove Money from {selectedJug?.name}
            </ThemedText>
            <TextInput
              style={styles.modalInput}
              placeholder="Amount..."
              placeholderTextColor={colors.textSecondary}
              value={transactionAmount}
              onChangeText={setTransactionAmount}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Transaction name (e.g., Emergency expense)"
              placeholderTextColor={colors.textSecondary}
              value={transactionName}
              onChangeText={setTransactionName}
            />
            <View style={styles.modalButtons}>
              <Pressable 
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => {
                  setShowRemoveMoneyModal(false);
                  setTransactionAmount('');
                  setTransactionName('');
                  setSelectedJug(null);
                }}
              >
                <ThemedText style={[styles.modalButtonText, styles.modalButtonTextSecondary]}>Cancel</ThemedText>
              </Pressable>
              <Pressable 
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleRemoveMoney}
              >
                <ThemedText style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>Remove Money</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </RNModal>

      {/* Jug Limit Modal */}
      <RNModal visible={showJugLimitModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Jug Limit Reached</ThemedText>
            <ThemedText style={{ textAlign: 'center', fontSize: 16, marginBottom: 20 }}>
              You've reached the maximum number of jugs (3).
            </ThemedText>
            <Pressable
              style={[styles.modalButton, styles.modalButtonPrimary]}
              onPress={() => setShowJugLimitModal(false)}
            >
              <ThemedText style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>OK</ThemedText>
            </Pressable>
          </View>
        </View>
      </RNModal>
    </ScrollView>
  );
}

