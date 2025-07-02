import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, View, TextInput, Alert, Modal as RNModal, Text as RNText, Image, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Header } from '@/components/Header';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { DatabaseLoading } from '@/components/DatabaseLoading';
import { ContinueReadingCard } from './components/ContinueReadingCard';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { analytics } from '@/services/analytics';
import { useDatabase } from '@/hooks/useDatabase';
import { 
  getAllSavingsJugs, 
  getSavingsStatistics,
  insertSavingsJug,
  getUserCompletedChaptersWithScore,
  getQuickReportDataByPeriod,
  initializeReadingLevel,
  getCurrentProfileReadingLevel,
  getAllBooks,
  getReadingStreakDetails,
  isCompletedChaptersTableEmpty,
  restoreCompletedChapters,
  getAllProfiles,
  diagnoseBalanceEarnedDiscrepancy,
  fixBalanceSynchronization,
  getCurrentProfile
} from '@/services/database';
import { 
  addMoneyToJug,
  removeMoneyFromJug
} from '@/services/savingsService';
import { 
  getCurrentReadingStatus,
  startRandomReading,
  startRandomUncompletedReading,
  getSmartBookDetails,
  updateReading,
  type CurrentReading,
  type Book
} from '@/services/readingService';
import { QuickReport } from './components/QuickReport';
import { Paywall } from './components/Paywall';
import { HOST_URL } from '@/config/api';
import { UpgradeModal } from './components/UpgradeModal';
import { DailyEarningLimitBanner } from './components/DailyEarningLimitBanner';
import { getDailyEarningLimitInfo, DailyEarningLimitInfo } from '@/services/dailyEarningLimit';

// Avatar images mapping
const AVATAR_IMAGES: { [key: string]: any } = {
  '1': require('@/assets/images/avatars/1.png'),
  '2': require('@/assets/images/avatars/2.png'),
  '3': require('@/assets/images/avatars/3.png'),
  '4': require('@/assets/images/avatars/4.png'),
  '5': require('@/assets/images/avatars/5.png'),
  '6': require('@/assets/images/avatars/6.png'),
  '7': require('@/assets/images/avatars/7.png'),
  '8': require('@/assets/images/avatars/8.png'),
  '9': require('@/assets/images/avatars/9.png'),
};

interface SavingsJug {
  id: number;
  name: string;
  balance: number;
  created: string;
  updated: string;
  emoji?: string;
  profile_id: string;
}

const JUG_EMOJIS = [
  '🐷', // piggy bank
  '💎', // diamond
  '🎯', // target
  '🌈', // rainbow
];

// Gradient palettes - will be defined inside component

// Emoji categories
const EMOJI_CATEGORIES = [
  { label: 'Shopping & Clothes', key: 'shopping_clothes', emojis: ['👖', '👟', '🧢', '👗', '🎒'] },
  { label: 'Style & Self-care', key: 'style_selfcare', emojis: ['💇‍♀️', '💅', '💄', '🧴'] },
  { label: 'Fun & Entertainment', key: 'fun_entertainment', emojis: ['🎬', '🍿', '🎮', '🎧'] },
  { label: 'Treats & Outings', key: 'treats_outings', emojis: ['🍦', '🍕', '🧃', '🥤', '🎡'] },
  { label: 'Big Goals', key: 'big_goals', emojis: ['🏖️', '📱', '💻', '🎂'] },
  { label: 'General Savings', key: 'general_savings', emojis: ['🐷', '💰', '🪙', '📈'] },
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
  const [dailyEarningLimitInfo, setDailyEarningLimitInfo] = useState<DailyEarningLimitInfo | null>(null);
  
  // QuickReport data state
  const [quickReportData, setQuickReportData] = useState<{
    lifetime: {
      booksRead: number;
      totalEarned: number;
      totalReadingTime: number;
    };
    week: {
      booksRead: number;
      totalEarned: number;
      totalReadingTime: number;
    };
    month: {
      booksRead: number;
      totalEarned: number;
      totalReadingTime: number;
    };
  } | null>(null);
  
  // Form states
  const [newJugName, setNewJugName] = useState('');
  const [transactionAmount, setTransactionAmount] = useState('');
  const [transactionName, setTransactionName] = useState('');

  // Add state for selected emoji
  const [selectedEmoji, setSelectedEmoji] = useState('🐷');

  // Add state for reading level
  const [currentReadingLevel, setCurrentReadingLevel] = useState<string>('Explorer');

  const [continueImage, setContinueImage] = useState<string>('');

  // Add state for reading streak
  const [readingStreak, setReadingStreak] = useState<{
    currentStreak: number;
    longestStreak: number;
    totalDaysRead: number;
    lastActivityDate: string | null;
  } | null>(null);

  // Add state for tracking completed books and paywall
  const [completedChaptersCount, setCompletedChaptersCount] = useState<number>(0);
  const [showChapterLimitPaywall, setShowChapterLimitPaywall] = useState(false);
  const [showUpgradeModal5, setShowUpgradeModal5] = useState(false);
  const [showUpgradeModal3, setShowUpgradeModal3] = useState(false);
  
  // Add state for first-time login paywall
  const [showFirstTimeLoginPaywall, setShowFirstTimeLoginPaywall] = useState(false);

  // Profile management state
  const [profiles, setProfiles] = useState<Array<{ id: number; uid: string; name: string; reading_level: string; avatar: string; created: string; updated: string }>>([]);
  const [selectedProfile, setSelectedProfile] = useState<{ id: number; uid: string; name: string; reading_level: string; avatar: string; created: string; updated: string } | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { isInitialized, isLoading: isDatabaseLoading } = useDatabase();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { isPremium, showPaywall } = useRevenueCat();

  // Gradient palettes
  const TOTAL_BALANCE_GRADIENT: [string, string] = isDark ? ['#23272f', '#3B27C1'] : ['#fceabb', '#f8b500']; // gold/yellow (light) or dark blue (dark)
  const JUG_GRADIENTS: [string, string][] = isDark
    ? [
        ['#23272f', '#3B27C1'], // dark blue
        ['#23272f', '#764ba2'], // dark purple
        ['#23272f', '#38f9d7'], // dark teal
        ['#23272f', '#f8b500'], // dark yellow
        ['#23272f', '#185a9d'], // dark aqua
        ['#23272f', '#f09819'], // dark orange
        ['#23272f', '#fa71cd'], // dark pink
        ['#23272f', '#330867'], // dark mint
      ]
    : [
        ['#667eea', '#764ba2'], // blue-purple
        ['#f093fb', '#f5576c'], // pink-orange
        ['#43e97b', '#38f9d7'], // teal-green
        ['#fceabb', '#f8b500'], // yellow-orange
        ['#43cea2', '#185a9d'], // aqua-blue
        ['#ff5858', '#f09819'], // red-orange
        ['#c471f5', '#fa71cd'], // lavender-pink
        ['#30cfd0', '#330867'], // mint-blue
      ];

  // Initialize reading level if not set
  const initializeUserReadingLevel = async () => {
    try {
      await initializeReadingLevel();
    } catch (error) {
      // ... existing code ...
    }
  };

  // Load reading level
  const loadReadingLevel = async () => {
    try {
      const readingLevel = await getCurrentProfileReadingLevel();
      setCurrentReadingLevel(readingLevel);
    } catch (error) {
      setCurrentReadingLevel('Explorer');
    }
  };

  // Count chapters per book and log the results
  const countChaptersPerBook = async () => {
    try {
      const allBooks = await getAllBooks();
      
      // Group books by book_id and count chapters
      const chaptersPerBook = allBooks.reduce((acc, book) => {
        if (!acc[book.book_id]) {
          acc[book.book_id] = {
            book_id: book.book_id,
            genre: book.genre,
            sub_genre: book.sub_genre,
            reading_level: book.reading_level,
            chapter_count: 0,
            chapters: []
          };
        }
        acc[book.book_id].chapter_count++;
        acc[book.book_id].chapters.push({
          chapter_number: book.chapter_number,
          chapter_name: book.chapter_name
        });
        return acc;
      }, {} as Record<string, {
        book_id: string;
        genre: string;
        sub_genre: string;
        reading_level: string;
        chapter_count: number;
        chapters: Array<{ chapter_number: number; chapter_name: string; }>;
      }>);

      // Sort books by chapter count (descending)
      const sortedBooks = Object.values(chaptersPerBook).sort((a, b) => b.chapter_count - a.chapter_count);
    
      
    } catch (error) {
      // Error counting chapters per book
    }
  };

  // Add function to refresh book count and check paywall
  const refreshChapterCountAndCheckPaywall = async () => {
    if (!selectedProfile) return;
    
    // Use the centralized refresh function for consistency
    await refreshAllDataForProfile(selectedProfile);
  };

  // Load savings data
  useEffect(() => {
    if (isInitialized && !isDatabaseLoading && selectedProfile) {
      refreshAllDataForProfile(selectedProfile);
    }
  }, [isInitialized, isDatabaseLoading, selectedProfile]);

  // Check for first-time login and show paywall
  useEffect(() => {
    const checkFirstTimeLogin = async () => {
      if (!user?.uid || isPremium) return;
      
      try {
        const firstTimeLoginKey = `firstTimeLogin_${user.uid}`;
        const hasLoggedInBefore = await AsyncStorage.getItem(firstTimeLoginKey);
        
        if (!hasLoggedInBefore) {
          // Track first-time login event
          analytics.track('first_time_login_paywall_shown', {
            userId: user.uid,
            timestamp: new Date().toISOString()
          });
          
          // This is the first time login, show paywall
          setShowFirstTimeLoginPaywall(true);
          // Mark that user has logged in before
          await AsyncStorage.setItem(firstTimeLoginKey, 'true');
        }
      } catch (error) {
        console.error('Error checking first-time login:', error);
      }
    };

    checkFirstTimeLogin();
  }, [user?.uid, isPremium]);

  // Reload all data when screen comes into focus (e.g., after completing a chapter)
  useFocusEffect(
    React.useCallback(() => {
      if (isInitialized && !isDatabaseLoading && selectedProfile) {
        refreshAllDataForProfile(selectedProfile);
      }
    }, [isInitialized, isDatabaseLoading, selectedProfile])
  );

  const loadSavingsData = async () => {
    if (!selectedProfile) {
      return;
    }

    // Use the centralized refresh function
    await refreshAllDataForProfile(selectedProfile);
  };

  const handleCreateJug = async () => {
    if (!newJugName.trim()) {
      Alert.alert('Error', 'Please enter a jug name');
      return;
    }
    if (!selectedEmoji) {
      Alert.alert('Error', 'Please select an emoji');
      return;
    }
    try {
      const profileId = selectedProfile?.uid || user?.uid || '';
      await insertSavingsJug({ name: newJugName.trim(), emoji: selectedEmoji, profile_id: profileId });
      setNewJugName('');
      setSelectedEmoji('🐷');
      setShowAddModal(false);
      await loadSavingsData();
    } catch (error) {
      setError('Failed to create savings goal');
    }
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
      const profileId = selectedProfile?.uid || user?.uid || '';
      await addMoneyToJug(selectedJug.id, amount, transactionName.trim(), profileId);
      setTransactionAmount('');
      setTransactionName('');
      setSelectedJug(null);
      setShowAddMoneyModal(false);
      await loadSavingsData();
    } catch (error) {
      setError('Failed to add money to jug');
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
      const profileId = selectedProfile?.uid || user?.uid || '';
      await removeMoneyFromJug(selectedJug.id, amount, transactionName.trim(), profileId);
      setTransactionAmount('');
      setTransactionName('');
      setSelectedJug(null);
      setShowRemoveMoneyModal(false);
      await loadSavingsData();
    } catch (error) {
      setError('Failed to remove money from jug');
    }
  };

  const handleStartReading = async () => {
    try {
      // Check if user has any savings goals
      if (jugs.length === 0) {
        Alert.alert(
          'Create Savings Goal First',
          'You need to create at least one savings goal before you can start reading. Reading helps you earn money for your goals!',
          [
            { text: 'OK', style: 'default' },
            { text: 'Create Goal', style: 'default', onPress: () => setShowAddModal(true) }
          ]
        );
        return;
      }

      // Check chapter limit for free users
      if (user?.uid && !isPremium && completedChaptersCount >= 10) {
        setShowChapterLimitPaywall(true);
        return;
      }

      setIsReadingLoading(true);
      
      // Use the new function to get a random uncompleted book
      const book = user?.uid 
        ? await startRandomUncompletedReading(user.uid, selectedProfile?.uid)
        : await startRandomReading(selectedProfile?.uid); // Fallback for users without UID
      
      // Track reading start
      analytics.trackStartNewBook({
        book_id: book.book_id,
        chapter_name: book.chapter_name,
        genre: book.genre,
        reading_level: book.reading_level,
        profile_id: selectedProfile?.uid,
        user_id: user?.uid
      });
      
      // Update current reading and book details
      const readingStatus = await getCurrentReadingStatus(selectedProfile?.uid);
      setCurrentReading(readingStatus);
      setCurrentBook(book);
      
      // Navigate to reading screen (you'll need to create this)
      router.push('/reading');
    } catch (error) {
      setError('Failed to start reading');
    } finally {
      setIsReadingLoading(false);
    }
  };

  const handleContinueReading = async () => {
    try {
      // Check if user has any savings goals
      if (jugs.length === 0) {
        Alert.alert(
          'Create Savings Goal First',
          'You need to create at least one savings goal before you can continue reading. Reading helps you earn money for your goals!',
          [
            { text: 'OK', style: 'default' },
            { text: 'Create Goal', style: 'default', onPress: () => setShowAddModal(true) }
          ]
        );
        return;
      }

      if (!currentReading || !smartBookDetails) {
        setError('No active reading session found');
        return;
      }
      
      // Check chapter limit for free users
      if (user?.uid && !isPremium && completedChaptersCount >= 10) {
        setShowChapterLimitPaywall(true);
        return;
      }
      
      setIsReadingLoading(true);
      
      let bookToContinue: Book | null = null;

      // When continuing reading, always continue with the current book or its next chapter
      if (smartBookDetails.isCompleted && smartBookDetails.hasNextChapter) {
        // Continue with next chapter
        bookToContinue = smartBookDetails.nextChapter;
        if (bookToContinue) {
          await updateReading({
            book_id: bookToContinue.book_id,
            chapter_number: bookToContinue.chapter_number,
            chapter_name: bookToContinue.chapter_name,
            profile_id: selectedProfile?.uid
          });
        }
      } else if (!smartBookDetails.isCompleted) {
        // Continue with current chapter
        bookToContinue = smartBookDetails.book;
      }
      
      if (!bookToContinue) {
        setError('No chapter to continue with');
        setIsReadingLoading(false);
        return;
      }
      
      setCurrentBook(bookToContinue);
      analytics.trackContinueReading({
        book_id: bookToContinue.book_id,
        chapter_name: bookToContinue.chapter_name,
        profile_id: selectedProfile?.uid,
        user_id: user?.uid,
        is_next_chapter: smartBookDetails.isCompleted && smartBookDetails.hasNextChapter
      });
      router.push('/reading');
    } catch (error) {
      setError('Failed to continue reading');
    } finally {
      setIsReadingLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Get reading level description
  const getReadingLevelDescription = (level: string) => {
    switch (level) {
      case 'Explorer':
        return 'Beginner stories with simple words';
      case 'Builder':
        return 'Slightly more complex phrasing, idioms';
      case 'Challenger':
        return 'More plot, bigger words';
      default:
        return 'Beginner stories with simple words';
    }
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
        message: `Check out this amazing savings app! 💰 Manage your savings goals with our jug system. Track your progress and build better financial habits.\n\nDownload now:\n📱 iOS: ${iosLink}\n Android: ${androidLink}`,
        title: 'Dimpo Reads App',
      });
    } catch (error) {
      // Error handling for share functionality
    }
  };

  useEffect(() => {
    const resolveContinueImage = async () => {
      if (currentBook && currentBook.images) {
        try {
          const imagesData = typeof currentBook.images === 'string' ? JSON.parse(currentBook.images) : currentBook.images;
          const firstImg = imagesData.illustrations && imagesData.illustrations[0];
          if (firstImg) {
            const url = `${HOST_URL}/public/learn/book/get-image?image=${firstImg}`;
            try {
              const res = await fetch(url, { method: 'HEAD' });
              if (res.ok) {
                setContinueImage(url);
                return;
              }
            } catch {}
          }
        } catch {}
      }
      setContinueImage(require('@/assets/images/dimpo/reading.png'));
    };
    resolveContinueImage();
  }, [currentBook]);

  // Load profiles and selected profiles
  useEffect(() => {
    const loadProfilesAndSelected = async () => {
      try {
        const allProfiles = await getAllProfiles();
        setProfiles(allProfiles);
        let selectedUid = await AsyncStorage.getItem('selectedProfileUid');
        let selected = allProfiles.find(p => p.uid === selectedUid);
        if (!selected && allProfiles.length > 0) {
          selected = allProfiles[0];
          await AsyncStorage.setItem('selectedProfileUid', selected.uid);
        }
        setSelectedProfile(selected || null);
      } catch (err) {
        setProfiles([]);
        setSelectedProfile(null);
      }
    };
    loadProfilesAndSelected();
  }, []);

  const handleSelectProfile = async (profile: { id: number; uid: string; name: string; reading_level: string; avatar: string; created: string; updated: string }) => {
    setSelectedProfile(profile);
    await AsyncStorage.setItem('selectedProfileUid', profile.uid);
    setShowProfileModal(false);
    
    // Immediately trigger data refresh for the new profile
    await refreshAllDataForProfile(profile);
  };

  // Function to refresh all data for a specific profile
  const refreshAllDataForProfile = async (profile: { id: number; uid: string; name: string; reading_level: string; avatar: string; created: string; updated: string }) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const learnerUid = user?.uid;
      
      if (!learnerUid) {
        return;
      }
      const profileId = profile.uid;

      // Check if completed chapters table is empty and restore from API if needed
      if (user?.uid) {
        const isEmpty = await isCompletedChaptersTableEmpty();
        if (isEmpty) {
          try {
            await restoreCompletedChapters(user.uid);
          } catch (restoreError) {
            // Failed to restore completed chapters
          }
        }
      }

      // Load all savings jars for the selected profile
      const allJugs = await getAllSavingsJugs(profileId);
      setJugs(allJugs);

      // Load savings statistics for the selected profile
      const stats = await getSavingsStatistics(profileId);
      setStatistics(stats);

      // Load current reading status
      const readingStatus = await getCurrentReadingStatus(profileId);
      setCurrentReading(readingStatus);

      // Load smart book details if there's an active reading session
      if (readingStatus) {
        const smartDetails = await getSmartBookDetails(learnerUid, profileId);
        setSmartBookDetails(smartDetails);
        
        // Set current book based on smart logic
        if (smartDetails) {
          if (smartDetails.isCompleted && smartDetails.hasNextChapter) {
            setCurrentBook(smartDetails.nextChapter);
          } else if (!smartDetails.isCompleted) {
            setCurrentBook(smartDetails.book);
          } else {
            setCurrentBook(null);
          }
        } else {
          setCurrentBook(null);
        }
      } else {
        setSmartBookDetails(null);
        setCurrentBook(null);
      }

      // Load completed chapters count
      const completedChapters = await getUserCompletedChaptersWithScore(profileId, 80);
      setCompletedChaptersCount(completedChapters.length);

      // Load QuickReport data
      const [lifetimeData, weekData, monthData] = await Promise.all([
        getQuickReportDataByPeriod('lifetime', profileId),
        getQuickReportDataByPeriod('week', profileId),
        getQuickReportDataByPeriod('month', profileId)
      ]);
      
      setQuickReportData({
        lifetime: lifetimeData,
        week: weekData,
        month: monthData
      });

      // Load reading level
      await loadReadingLevel();

      // Load reading streak data
      const streakDetails = await getReadingStreakDetails(profileId);
      setReadingStreak(streakDetails);

      // Check paywall conditions for free users
      if (user?.uid && !isPremium) {
        // Show upgrade modal at 5 chapters remaining (5 completed)
        if (completedChapters.length === 5) {
          setShowUpgradeModal5(true);
        }
        
        // Show upgrade modal at 3 chapters remaining (7 completed)
        if (completedChapters.length === 7) {
          setShowUpgradeModal3(true);
        }
        
        // Show paywall if user has completed 10 or more chapters
        if (completedChapters.length >= 10) {
          setShowChapterLimitPaywall(true);
        }
      }

      // Count chapters per book and log the results
      await countChaptersPerBook();

      // Load daily earning limit info
      await loadDailyEarningLimitInfo();
    } catch (error) {
      setError('Failed to load profile data');
    } finally {
      setIsLoading(false);
    }
  };

  // Effect to reload all data when selectedProfile changes
  // Note: We don't need this effect since we call refreshAllDataForProfile directly in handleSelectProfile
  // This was causing duplicate calls and potential race conditions
  // useEffect(() => {
  //   if (!selectedProfile) return;
  //   refreshAllDataForProfile(selectedProfile);
  // }, [selectedProfile]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: 20,
      backgroundColor: colors.background, // theme background
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
      color: colors.textSecondary,
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
      color: colors.textSecondary,
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
      backgroundColor: colors.surface,
      paddingVertical: 22,
      paddingHorizontal: 20,
      borderRadius: 18,
      marginBottom: 18,
      marginHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.border,
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
      backgroundColor: isDark ? 'rgba(20, 20, 20, 0.7)' : 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
      alignItems: 'center',
      height: '90%',
      marginTop: 64,
    },
    modalContent: {
      backgroundColor: colors.surface,
      padding: 24,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      width: '100%',
      maxWidth: '100%',
      minHeight: '70%',
      flex: 1,
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
      gap: 20,
      paddingHorizontal: 20,
      marginBottom: 20,
    },
    mainActionButton: {
      backgroundColor: colors.primary,
      paddingVertical: 20,
      paddingHorizontal: 32,
      borderRadius: 16,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 6,
      minHeight: 64,
      borderWidth: 2,
      borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    actionButtonPressed: {
      opacity: 0.8,
      transform: [{ scale: 0.98 }],
    },
    mainActionButtonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: 0.5,
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
      backgroundColor: colors.primary,
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
      backgroundColor: colors.surface,
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
      justifyContent: 'center',
      marginBottom: 2,
    },
    jugEmoji: {
      fontSize: 36,
      paddingTop: 14,
      color: colors.text,
    },
    jugGridName: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginTop: 6,
      marginBottom: 2,
      textAlign: 'center',
    },
    jugGridBalance: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.primary,
      marginTop: 2,
      textAlign: 'center',
    },
    totalBalanceCard: {
      backgroundColor: colors.surface,
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
      paddingTop: 18,
      marginBottom: 2,
      color: colors.text,
    },
    totalBalanceLabel: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 0,
      textAlign: 'center',
      lineHeight: 24,
    },
    totalBalanceAmount: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.primary,
      marginTop: 2,
      paddingTop: 0,
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
    placeholderCard: {
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    placeholderContent: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    placeholderEmoji: {
      fontSize: 36,
      marginBottom: 8,
      color: colors.textSecondary,
      paddingTop: 10,
    },
    placeholderText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
      textAlign: 'center',
    },
    readingLevelCard: {
      backgroundColor: colors.surface,
      padding: 16,
      borderRadius: 12,
      marginHorizontal: 20,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    readingLevelContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    readingLevelEmoji: {
      fontSize: 36,
      marginRight: 12,
      paddingTop: 18,
      color: colors.text,
    },
    readingLevelTextContainer: {
      flexDirection: 'column',
    },
    readingLevelLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    readingLevelValue: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.primary,
    },
    readingLevelDescription: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    readingStreakCard: {
      backgroundColor: colors.surface,
      padding: 16,
      borderRadius: 12,
      marginHorizontal: 20,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    readingStreakContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    readingStreakEmoji: {
      fontSize: 36,
      marginRight: 12,
      paddingTop: 18,
      color: colors.text,
    },
    readingStreakTextContainer: {
      flexDirection: 'column',
    },
    readingStreakLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    readingStreakValue: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.primary,
    },
    readingStreakDescription: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    combinedStatsCard: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      paddingVertical: 24,
      paddingHorizontal: 18,
      marginHorizontal: 10,
      marginBottom: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    statsSection: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-start',
      flexDirection: 'column',
      minHeight: 90,
    },
    combinedStatsEmoji: {
      fontSize: 38,
      paddingTop: 18,
      marginBottom: 2,
      color: colors.text,
    },
    combinedStatsLabel: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 0,
      textAlign: 'center',
      lineHeight: 24,
    },
    combinedStatsValue: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.primary,
      marginTop: 2,
      paddingTop: 0,
      textAlign: 'center',
    },
    combinedStatsDescription: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 2,
    },
    statsDivider: {
      width: 1,
      height: 80,
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
      marginHorizontal: 20,
    },
    addGoalCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 24,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
    },
    addGoalContent: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    addGoalEmoji: {
      fontSize: 32,
      marginBottom: 16,
      color: colors.text,
      paddingTop: 18,
    },
    addGoalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    addGoalDescription: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 24,
    },
    addGoalButton: {
      backgroundColor: colors.primary,
      paddingVertical: 16,
      paddingHorizontal: 32,
      borderRadius: 12,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    addGoalButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  // Show database loading if database is not initialized
  if (!isInitialized || isDatabaseLoading) {
    return <DatabaseLoading message="Loading app..." />;
  }

  const loadDailyEarningLimitInfo = async () => {
    try {
      const profileId = selectedProfile?.uid;
      const limitInfo = await getDailyEarningLimitInfo(profileId);
      setDailyEarningLimitInfo(limitInfo);
    } catch (error) {
      // Error loading daily earning limit info
    }
  };

  return (
    <LinearGradient
      colors={isDark ? ['#23272f', '#3B27C1'] : ['#fceabb', '#f8b500']}
      style={{ flex: 1 }}
    >
      <Header selectedProfile={selectedProfile} />
      <ThemedView style={styles.container}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <ThemedText style={styles.loadingText}>Loading...</ThemedText>
          </View>
        ) : error ? (
          <ThemedText>{error}</ThemedText>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Profile Card at the Top - Only show if there are multiple profiles */}
            {profiles.length > 1 && (
              <View style={{ width: '100%', paddingHorizontal: 0, marginTop: 16, marginBottom: 16 }}>
                <Pressable
                  style={{
                    backgroundColor: isDark ? '#23223b' : '#fff',
                    borderRadius: 18,
                    marginHorizontal: 16,
                    marginTop: 0,
                    marginBottom: 0,
                    paddingVertical: 24,
                    paddingHorizontal: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.08,
                    shadowRadius: 8,
                    elevation: 2,
                  }}
                  onPress={() => setShowProfileModal(true)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {selectedProfile?.avatar ? (
                      <Image
                        source={AVATAR_IMAGES[selectedProfile.avatar] || AVATAR_IMAGES['1']}
                        style={{ width: 48, height: 48, borderRadius: 24, marginRight: 16 }}
                        resizeMode="cover"
                      />
                    ) : (
                      <RNText style={{ fontSize: 38, marginRight: 16 }}>👤</RNText>
                    )}
                    <View>
                      <RNText style={{ color: isDark ? '#fff' : '#222', fontWeight: '700', fontSize: 20, marginBottom: 2 }}>
                        {selectedProfile ? selectedProfile.name : 'No profile selected'}
                      </RNText>
                      <RNText style={{ color: '#4F46E5', fontWeight: '600', fontSize: 14 }}>Tap to change reader</RNText>
                    </View>
                  </View>
                  <RNText style={{ color: '#4F46E5', fontWeight: '700', fontSize: 18 }}>Change</RNText>
                </Pressable>
              </View>
            )}
            
            
            
            {/* Combined Balance and Streak Card */}
            <LinearGradient
              colors={TOTAL_BALANCE_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.combinedStatsCard}
            >
              {/* Balance Section */}
              <View style={styles.statsSection}>
                <ThemedText style={styles.combinedStatsEmoji}>💰</ThemedText>
                <ThemedText style={[styles.combinedStatsLabel, { color: '#fff' }]}>Total Balance</ThemedText>
                <ThemedText style={[styles.combinedStatsValue, { color: '#fff' }]}>{formatCurrency(statistics?.total_balance || 0)}</ThemedText>
              </View>

              {/* Divider */}
              <View style={styles.statsDivider} />

              {/* Streak Section */}
              <View style={styles.statsSection}>
                <ThemedText style={styles.combinedStatsEmoji}>🔥</ThemedText>
                <ThemedText style={[styles.combinedStatsLabel, { color: '#fff' }]}>Reading Streak</ThemedText>
                <ThemedText style={[styles.combinedStatsValue, { color: '#fff' }]}> 
                  {readingStreak ? `${readingStreak.currentStreak} days` : '0 days'}
                </ThemedText>
              </View>
            </LinearGradient>

            {/* Daily Earning Limit Banner */}
            {dailyEarningLimitInfo && <DailyEarningLimitBanner dailyEarningLimitInfo={dailyEarningLimitInfo} />}

            {/* Reading Level Card */}
            <View style={styles.readingLevelCard}>
              <View style={styles.readingLevelContent}>
                <ThemedText style={styles.readingLevelEmoji}>
                  {currentReadingLevel === 'Explorer' ? '🧭' : 
                   currentReadingLevel === 'Builder' ? '🧱' : '🧗‍♂️'}
                </ThemedText>
                <View style={styles.readingLevelTextContainer}>
                  <ThemedText style={styles.readingLevelLabel}>Reading Level</ThemedText>
                  <ThemedText style={styles.readingLevelValue}>{currentReadingLevel}</ThemedText>
                  <ThemedText style={styles.readingLevelDescription}>
                    {getReadingLevelDescription(currentReadingLevel)}
                  </ThemedText>
                </View>
              </View>
            </View>

            {/* Empty State or Jugs List */}
            <View style={styles.jugsHeader}>
              <ThemedText style={styles.jugsTitle}>Your Savings Goals</ThemedText>
              <Pressable
                style={styles.addJugButton}
                onPress={() => {
                  if (jugs.length >= 4) {
                    setShowJugLimitModal(true);
                  } else {
                    setShowAddModal(true);
                  }
                }}
              >
                <ThemedText style={styles.addJugButtonText}>＋ Add Goal</ThemedText>
              </Pressable>
            </View>
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
                    onPress={() => router.push(`/jug-transactions?jugId=${jug.id}`)}
                  >
                    <View style={styles.jugGridHeader}>
                      <ThemedText style={[styles.jugEmoji, { color: '#fff' }]}>{jug.emoji || JUG_EMOJIS[idx % JUG_EMOJIS.length]}</ThemedText>
                    </View>
                    <ThemedText style={[styles.jugGridName, { color: '#fff' }]}>{jug.name}</ThemedText>
                    <ThemedText style={[styles.jugGridBalance, { color: '#fff' }]}>{formatCurrency(jug.balance)}</ThemedText>
                  </Pressable>
                </LinearGradient>
              ))}
              {/* Show placeholder when user has only 1 jug */}
              {jugs.length === 1 && (
                <Pressable
                  style={({ pressed }) => [
                    styles.jugGridCard,
                    styles.placeholderCard,
                    pressed && styles.jugGridPressed
                  ]}
                  onPress={() => setShowAddModal(true)}
                  android_ripple={{ color: '#e5e7eb' }}
                >
                  <View style={styles.placeholderContent}>
                    <ThemedText style={styles.placeholderEmoji}>➕</ThemedText>
                    <ThemedText style={styles.placeholderText}>Add Another Goal</ThemedText>
                  </View>
                </Pressable>
              )}
            </View>

            {/* Other Action Buttons */}
            <View style={styles.actionButtonsContainer}>
              {/* Continue Reading Card or Start New Book Card */}
              {(() => {
                if (currentReading && smartBookDetails) {
                  if (currentBook && jugs.length > 0) {
                    return (
                      <ContinueReadingCard
                        book={{ ...currentBook, images: continueImage }}
                        onPress={jugs.length === 0 ? () => {
                          Alert.alert(
                            'Create Savings Goal First',
                            'You need to create at least one savings goal before you can continue reading. Reading helps you earn money for your goals!',
                            [
                              { text: 'OK', style: 'default' },
                              { text: 'Create Goal', style: 'default', onPress: () => setShowAddModal(true) }
                            ]
                          );
                        } : handleContinueReading}
                        isLoading={isReadingLoading}
                        isNextChapter={smartBookDetails.isCompleted && smartBookDetails.hasNextChapter}
                        disabled={jugs.length === 0}
                      />
                    );
                  } else {
                    // Show add goal card when no current book and no savings goals
                    if (jugs.length === 0) {
                      return (
                        <View style={styles.addGoalCard}>
                          <View style={styles.addGoalContent}>
                            <ThemedText style={styles.addGoalEmoji}>🎯</ThemedText>
                            <ThemedText style={styles.addGoalTitle}>Create Your First Savings Goal</ThemedText>
                            <ThemedText style={styles.addGoalDescription}>
                              Start your reading journey by creating a savings goal. Every chapter you read earns money for your goals!
                            </ThemedText>
                            <Pressable
                              style={({ pressed }) => [
                                styles.addGoalButton,
                                pressed && styles.actionButtonPressed,
                              ]}
                              onPress={() => setShowAddModal(true)}
                              accessibilityRole="button"
                              accessibilityLabel="Create savings goal"
                            >
                              <ThemedText style={styles.addGoalButtonText}>➕ Create Goal</ThemedText>
                            </Pressable>
                          </View>
                        </View>
                      );
                    }
                    
                    return (
                      <LinearGradient
                        colors={isDark ? ['#4F46E5', '#7C3AED'] : ['#3B82F6', '#8B5CF6']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[
                          styles.mainActionButton,
                          isReadingLoading && styles.actionButtonDisabled,
                        ]}
                      >
                        <Pressable
                          style={({ pressed }) => [
                            { flex: 1, justifyContent: 'center', alignItems: 'center' },
                            pressed && styles.actionButtonPressed,
                          ]}
                          onPress={handleStartReading}
                          disabled={isReadingLoading}
                          accessibilityRole="button"
                          accessibilityLabel="Start new book"
                        >
                          <ThemedText style={styles.mainActionButtonText}>
                            {isReadingLoading ? '⏳ Loading...' : '🚀 Start New Book'}
                          </ThemedText>
                        </Pressable>
                      </LinearGradient>
                    );
                  }
                } else {
                  // Show add goal card when no reading session and no savings goals
                  if (jugs.length === 0) {
                    return (
                      <View style={styles.addGoalCard}>
                        <View style={styles.addGoalContent}>
                          <ThemedText style={styles.addGoalEmoji}>🎯</ThemedText>
                          <ThemedText style={styles.addGoalTitle}>Create Your First Savings Goal</ThemedText>
                          <ThemedText style={styles.addGoalDescription}>
                            Start your reading journey by creating a savings goal. Every chapter you read earns money for your goals!
                          </ThemedText>
                          <Pressable
                            style={({ pressed }) => [
                              styles.addGoalButton,
                              pressed && styles.actionButtonPressed,
                            ]}
                            onPress={() => setShowAddModal(true)}
                            accessibilityRole="button"
                            accessibilityLabel="Create savings goal"
                          >
                            <ThemedText style={styles.addGoalButtonText}>➕ Create Goal</ThemedText>
                          </Pressable>
                        </View>
                      </View>
                    );
                  }
                  
                  return (
                    <LinearGradient
                      colors={isDark ? ['#4F46E5', '#7C3AED'] : ['#3B82F6', '#8B5CF6']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.mainActionButton,
                        isReadingLoading && styles.actionButtonDisabled,
                      ]}
                    >
                      <Pressable
                        style={({ pressed }) => [
                          { flex: 1, justifyContent: 'center', alignItems: 'center' },
                          pressed && styles.actionButtonPressed,
                        ]}
                        onPress={handleStartReading}
                        disabled={isReadingLoading}
                        accessibilityRole="button"
                        accessibilityLabel="Start reading"
                      >
                        <ThemedText style={styles.mainActionButtonText}>
                          {isReadingLoading ? '⏳ Loading...' : '🚀 Start New Book'}
                        </ThemedText>
                      </Pressable>
                    </LinearGradient>
                  );
                }
              })()}

              {/* Report Button */}
              <QuickReport 
                lifetimeData={quickReportData?.lifetime || { booksRead: 0, totalEarned: 0, totalReadingTime: 0 }}
                weekData={quickReportData?.week || { booksRead: 0, totalEarned: 0, totalReadingTime: 0 }}
                monthData={quickReportData?.month || { booksRead: 0, totalEarned: 0, totalReadingTime: 0 }}
              />
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
          </ScrollView>
        )}
      </ThemedView>

      {/* Add Jug Modal */}
      <RNModal visible={showAddModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ScrollView style={{ width: '100%', flex: 1, height: '80%' }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-start' }}>
            <View style={styles.modalContent}>
              <ThemedText style={styles.modalTitle}>Create New Savings Goal</ThemedText>
              <ThemedText style={{ fontWeight: '600', fontSize: 16, marginBottom: 8 }}>Choose an emoji</ThemedText>
              <View style={{ marginBottom: 16}}>
                <ScrollView>
                  {EMOJI_CATEGORIES.map(category => (
                    <View key={category.key} style={{ marginBottom: 6 }}>
                      <ThemedText style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 2 }}>{category.label}</ThemedText>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {category.emojis.map(emoji => (
                          <Pressable
                            key={emoji}
                            onPress={() => setSelectedEmoji(emoji)}
                            style={{
                              padding: 6,
                              borderRadius: 8,
                              backgroundColor: selectedEmoji === emoji ? colors.primary : 'transparent',
                              marginRight: 6,
                              marginBottom: 2,
                            }}
                          >
                            <ThemedText style={{ fontSize: 28, paddingTop: 8, color: selectedEmoji === emoji ? '#fff' : colors.text }}>{emoji}</ThemedText>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter jar name..."
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
                  style={[styles.modalButton, styles.modalButtonPrimary, { backgroundColor: colors.primary }]}
                  onPress={handleCreateJug}
                >
                  <ThemedText style={[styles.modalButtonText, { color: '#fff' }]}>Create</ThemedText>
                </Pressable>
              </View>
            </View>
          </ScrollView>
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
              You've reached the maximum number of jugs (4).
            </ThemedText>
            <Pressable
              style={{
                alignSelf: 'center',
                backgroundColor: colors.primary,
                paddingVertical: 14,
                paddingHorizontal: 40,
                borderRadius: 12,
                marginTop: 8,
                minWidth: 120,
              }}
              onPress={() => setShowJugLimitModal(false)}
            >
              <ThemedText style={{ color: '#fff', fontWeight: '700', fontSize: 16, textAlign: 'center' }}>OK</ThemedText>
            </Pressable>
          </View>
        </View>
      </RNModal>

      {/* Chapter Limit Paywall */}
      {showChapterLimitPaywall && (
        <Paywall
          onSuccess={() => {
            setShowChapterLimitPaywall(false);
            // Refresh data after successful upgrade
            loadSavingsData();
            refreshChapterCountAndCheckPaywall();
          }}
          onClose={() => {
            setShowChapterLimitPaywall(false);
          }}
        />
      )}

      {/* First Time Login Paywall */}
      {showFirstTimeLoginPaywall && (
        <Paywall
          onSuccess={() => {
            setShowFirstTimeLoginPaywall(false);
            // Refresh data after successful upgrade
            loadSavingsData();
          }}
          onClose={() => {
            // Track first-time login paywall closed without purchase
            analytics.track('first_time_login_paywall_closed', {
              userId: user?.uid,
              timestamp: new Date().toISOString()
            });
            setShowFirstTimeLoginPaywall(false);
          }}
        />
      )}

      {/* Upgrade Modal - 5 Chapters Remaining */}
      <UpgradeModal
        visible={showUpgradeModal5}
        onClose={() => setShowUpgradeModal5(false)}
        onUpgrade={() => {
          setShowUpgradeModal5(false);
          showPaywall();
        }}
        emoji="🚀"
        title="Upgrade to Premium"
        completed={5}
        remaining={5}
        description="You've completed 5 chapters! Only 5 more free chapters remaining. Upgrade to Premium for unlimited access to all chapters and features!"
      />

      {/* Upgrade Modal - 3 Chapters Remaining */}
      <UpgradeModal
        visible={showUpgradeModal3}
        onClose={() => setShowUpgradeModal3(false)}
        onUpgrade={() => {
          setShowUpgradeModal3(false);
          showPaywall();
        }}
        emoji="⚠️"
        title="Almost at the Limit"
        completed={7}
        remaining={3}
        description="You've completed 7 chapters! Only 3 more free chapters remaining. Don't let your reading journey stop here! Upgrade to Premium for unlimited access."
      />

      {/* Profile Switcher Modal */}
      <RNModal
        visible={showProfileModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowProfileModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#F3F0FF', borderRadius: 28, padding: 28, minWidth: 320, maxWidth: 380, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 16, elevation: 6, borderWidth: 2, borderColor: '#A5B4FC' }}>
            {/* Close button */}
            <Pressable
              onPress={() => setShowProfileModal(false)}
              style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, backgroundColor: '#fff', borderRadius: 16, padding: 6, borderWidth: 1, borderColor: '#E0E7FF' }}
              accessibilityLabel="Close profile switcher"
            >
              <RNText style={{ fontSize: 20, color: '#4F46E5', fontWeight: '700' }}>✖️</RNText>
            </Pressable>
            <RNText style={{ fontWeight: '800', fontSize: 28, marginBottom: 4, textAlign: 'center', color: '#4F46E5', letterSpacing: 1 }}>Who's Reading?</RNText>
            <RNText style={{ fontSize: 16, marginBottom: 18, textAlign: 'center', color: '#6366F1' }}>Tap your name to start your reading adventure!</RNText>
            {profiles.length === 0 ? (
              <RNText style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', fontSize: 16 }}>No profiles found.</RNText>
            ) : (
              <View style={{ width: '100%', marginBottom: 8 }}>
                {profiles.map(profile => (
                  <Pressable
                    key={profile.uid}
                    style={{
                      width: '100%',
                      backgroundColor: selectedProfile?.uid === profile.uid ? '#A5B4FC' : '#fff',
                      borderRadius: 16,
                      paddingVertical: 18,
                      paddingHorizontal: 20,
                      marginBottom: 14,
                      alignItems: 'center',
                      flexDirection: 'row',
                      borderWidth: selectedProfile?.uid === profile.uid ? 2 : 1,
                      borderColor: selectedProfile?.uid === profile.uid ? '#6366F1' : '#E0E7FF',
                      shadowColor: selectedProfile?.uid === profile.uid ? '#6366F1' : 'transparent',
                      shadowOpacity: selectedProfile?.uid === profile.uid ? 0.15 : 0,
                      shadowRadius: 8,
                      elevation: selectedProfile?.uid === profile.uid ? 2 : 0,
                    }}
                    onPress={() => handleSelectProfile(profile)}
                  >
                    {profile.avatar ? (
                      <Image
                        source={AVATAR_IMAGES[profile.avatar] || AVATAR_IMAGES['1']}
                        style={{ width: 40, height: 40, borderRadius: 20, marginRight: 16 }}
                        resizeMode="cover"
                      />
                    ) : (
                      <RNText style={{ fontSize: 28, marginRight: 16 }}>👤</RNText>
                    )}
                    <View style={{ flex: 1 }}>
                      <RNText style={{ color: '#4F46E5', fontWeight: '700', fontSize: 20 }}>{profile.name}</RNText>
                      <RNText style={{ color: '#6366F1', fontWeight: '500', fontSize: 14, marginTop: 2 }}>{profile.reading_level}</RNText>
                    </View>
                    {selectedProfile?.uid === profile.uid && (
                      <RNText style={{ marginLeft: 10, fontSize: 18, color: '#6366F1', fontWeight: '700' }}>✓</RNText>
                    )}
                  </Pressable>
                ))}
              </View>
            )}
            <RNText style={{ color: '#6366F1', fontWeight: '600', fontSize: 15, marginTop: 8, textAlign: 'center' }}>Not you? Ask an adult to add your name in the Profile screen!</RNText>
          </View>
        </View>
      </RNModal>
    </LinearGradient>
  );
}

