import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, View, TextInput, Alert, Modal as RNModal } from 'react-native';
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
  getAllCompletedChapters,
  getUserCompletedChaptersWithScore,
  getUserCompletedBooksCount,
  getQuickReportData,
  getQuickReportDataByPeriod,
  initializeReadingLevel,
  getCurrentReadingLevel,
  getAllBooks,
  calculateReadingStreak,
  getReadingStreakDetails,
  isCompletedChaptersTableEmpty,
  restoreCompletedChapters
} from '@/services/database';
import { 
  addMoneyToJug,
  removeMoneyFromJug
} from '@/services/savingsService';
import { 
  getCurrentReadingStatus,
  startRandomReading,
  startRandomUncompletedReading,
  isCurrentlyReading,
  getCurrentBookDetails,
  getSmartBookDetails,
  updateReading,
  type CurrentReading,
  type Book
} from '@/services/readingService';
import { QuickReport } from './components/QuickReport';
import { Paywall } from './components/Paywall';
import { HOST_URL } from '@/config/api';

interface SavingsJug {
  id: number;
  name: string;
  balance: number;
  created: string;
  updated: string;
  emoji?: string;
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
  
  // QuickReport data state
  const [quickReportData, setQuickReportData] = useState<{
    lifetime: {
      booksRead: number;
      totalEarned: number;
      chaptersRead: number;
    };
    week: {
      booksRead: number;
      totalEarned: number;
      chaptersRead: number;
    };
    month: {
      booksRead: number;
      totalEarned: number;
      chaptersRead: number;
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

  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { isInitialized, isLoading: isDatabaseLoading } = useDatabase();
  const { user } = useAuth();
  const { isPremium, showPaywall } = useRevenueCat();

  // Initialize reading level if not set
  const initializeUserReadingLevel = async () => {
    try {
      await initializeReadingLevel();
    } catch (error) {
      console.error('Error initializing reading level in HomeScreen:', error);
    }
  };

  // Load reading level
  const loadReadingLevel = async () => {
    try {
      const readingLevel = await getCurrentReadingLevel();
      setCurrentReadingLevel(readingLevel);
    } catch (error) {
      console.error('Error loading reading level:', error);
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

      // Log the chapter counts
      console.log('=== CHAPTERS PER BOOK COUNT ===');
      console.log(`Total unique books: ${Object.keys(chaptersPerBook).length}`);
      console.log(`Total chapters: ${allBooks.length}`);
      
      // Sort books by chapter count (descending)
      const sortedBooks = Object.values(chaptersPerBook).sort((a, b) => b.chapter_count - a.chapter_count);
      
      sortedBooks.forEach((book, index) => {
        console.log(`${index + 1}. ${book.book_id} (${book.genre}/${book.sub_genre})`);
        console.log(`   Reading Level: ${book.reading_level}`);
        console.log(`   Chapters: ${book.chapter_count}`);
        console.log(`   Chapter List: ${book.chapters.map(c => `${c.chapter_number}:${c.chapter_name}`).join(', ')}`);
        console.log('---');
      });
      
      // Summary statistics
      const avgChaptersPerBook = allBooks.length / Object.keys(chaptersPerBook).length;
      const maxChapters = Math.max(...sortedBooks.map(b => b.chapter_count));
      const minChapters = Math.min(...sortedBooks.map(b => b.chapter_count));
      
      console.log('Summary:');
      console.log(`- Average chapters per book: ${avgChaptersPerBook.toFixed(1)}`);
      console.log(`- Most chapters in a book: ${maxChapters}`);
      console.log(`- Least chapters in a book: ${minChapters}`);
      console.log('=== END CHAPTERS PER BOOK COUNT ===');
      
    } catch (error) {
      console.error('Error counting chapters per book:', error);
    }
  };

  // Add function to refresh book count and check paywall
  const refreshChapterCountAndCheckPaywall = async () => {
    if (user?.uid && !isPremium) {
      const chaptersCount = await getUserCompletedChaptersWithScore(user.uid);
      setCompletedChaptersCount(chaptersCount.length);
      console.log('Refreshed completed chapters count:', chaptersCount.length);
      
      // Show upgrade modal at 5 chapters remaining (5 completed)
      if (chaptersCount.length === 5) {
        setShowUpgradeModal5(true);
      }
      
      // Show upgrade modal at 3 chapters remaining (7 completed)
      if (chaptersCount.length === 7) {
        setShowUpgradeModal3(true);
      }
      
      // Show paywall if user has completed 10 or more chapters
      if (chaptersCount.length >= 10) {
        setShowChapterLimitPaywall(true);
      }
    }
  };

  // Load savings data
  useEffect(() => {
    if (isInitialized && !isDatabaseLoading) {
      loadSavingsData();
      initializeUserReadingLevel(); // Initialize reading level
    }
  }, [isInitialized, isDatabaseLoading]);

  // Reload all data when screen comes into focus (e.g., after completing a chapter)
  useFocusEffect(
    React.useCallback(() => {
      if (isInitialized && !isDatabaseLoading) {
        loadSavingsData();
        initializeUserReadingLevel(); // Initialize reading level on focus
        refreshChapterCountAndCheckPaywall(); // Refresh book count and check paywall
      }
    }, [isInitialized, isDatabaseLoading])
  );

  const loadSavingsData = async () => {
    try {
      console.log('Loading savings data...');
      setIsLoading(true);
      setError(null);

      // Check if completed chapters table is empty and restore from API if needed
      if (user?.uid) {
        const isEmpty = await isCompletedChaptersTableEmpty();
        if (isEmpty) {
          console.log('Completed chapters table is empty, attempting to restore from API...');
          try {
            await restoreCompletedChapters(user.uid);
            console.log('Completed chapters restored successfully');
          } catch (restoreError) {
            console.error('Error restoring completed chapters:', restoreError);
            // Continue loading other data even if restoration fails
          }
        }
      }else{
        console.log('User not found');
      }

      // Load all savings jars
      const allJugs = await getAllSavingsJugs();
      
      // If no jars exist, create a generic savings jar
      if (allJugs.length === 0) {
        try {
          await insertSavingsJug({ 
            name: 'My Piggy Bank', 
            emoji: '🐷' 
          });
          // Reload the jars after creating the generic one
          const updatedJugs = await getAllSavingsJugs();
          setJugs(updatedJugs);
        } catch (createError) {
          console.error('Error creating generic savings jar:', createError);
          setJugs(allJugs); // Still set the empty array if creation fails
        }
      } else {
        setJugs(allJugs);
      }

      // Load statistics
      const stats = await getSavingsStatistics();
      setStatistics(stats);

      // Load current reading status
      const readingStatus = await getCurrentReadingStatus();
      setCurrentReading(readingStatus);

      // Load smart book details if there's an active reading session
      if (readingStatus) {
        const smartDetails = await getSmartBookDetails(user?.uid);
        setSmartBookDetails(smartDetails);
        
        // Set current book based on smart logic
        if (smartDetails) {
          console.log('Smart book details:', smartDetails);
          if (smartDetails.isCompleted && smartDetails.hasNextChapter) {
            console.log('Smart book details2:');
            // Show next chapter if current is completed
            setCurrentBook(smartDetails.nextChapter);
          } else if (!smartDetails.isCompleted) {
            console.log('Smart book details3:');
            // Show current chapter if not completed
            setCurrentBook(smartDetails.book);
          } else {
            console.log('Smart book details4:');
            // Debug: Log all chapters for this book_id with chapter_number > 1
            if (smartDetails && smartDetails.book && smartDetails.book.book_id) {
              (async () => {
                const allBooks = await getAllBooks();
                const nextChapters = allBooks.filter(b => b.book_id === smartDetails.book!.book_id);
                console.log('All chapters for book_id', smartDetails.book!.book_id, 'with chapter_number > 1:', nextChapters);
              })();
            }
            // Current chapter is completed and no next chapter - don't show continue reading
            setCurrentBook(null);
          }
        } else {
          console.log('Smart book details5:', smartDetails);
          setCurrentBook(null);
        }
      } else {
        console.log('Smart book details6:');
        setSmartBookDetails(null);
        setCurrentBook(null);
      }

      // Load all completed chapters
      const completedChapters = user?.uid 
        ? await getUserCompletedChaptersWithScore(user.uid)
        : await getAllCompletedChapters();
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

      // Load QuickReport data
      const [lifetimeData, weekData, monthData] = await Promise.all([
        getQuickReportDataByPeriod(user?.uid, 'lifetime'),
        getQuickReportDataByPeriod(user?.uid, 'week'),
        getQuickReportDataByPeriod(user?.uid, 'month')
      ]);
      
      setQuickReportData({
        lifetime: lifetimeData,
        week: weekData,
        month: monthData
      });
      console.log('QuickReport data loaded:', { lifetimeData, weekData, monthData });

      // Load reading level
      await loadReadingLevel();

      // Load reading streak data
      const streakDetails = await getReadingStreakDetails(user?.uid);
      setReadingStreak(streakDetails);
      console.log('Reading streak data loaded:', streakDetails);

      // Load completed books count for free users
      if (user?.uid && !isPremium) {
        const chaptersCount = await getUserCompletedChaptersWithScore(user.uid);
        setCompletedChaptersCount(chaptersCount.length);
        console.log('Completed chapters count:', chaptersCount.length);
        
        // Show upgrade modal at 5 chapters remaining (5 completed)
        if (chaptersCount.length === 5) {
          setShowUpgradeModal5(true);
        }
        
        // Show upgrade modal at 3 chapters remaining (7 completed)
        if (chaptersCount.length === 7) {
          setShowUpgradeModal3(true);
        }
        
        // Show paywall if user has completed 10 or more chapters
        if (chaptersCount.length >= 10) {
          setShowChapterLimitPaywall(true);
        }
      }

      // Count chapters per book and log the results
      await countChaptersPerBook();

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
    if (!selectedEmoji) {
      Alert.alert('Error', 'Please select an emoji');
      return;
    }
    try {
      await insertSavingsJug({ name: newJugName.trim(), emoji: selectedEmoji });
      setNewJugName('');
      setSelectedEmoji('🐷');
      setShowAddModal(false);
      await loadSavingsData();
    } catch (error) {
      setError('Failed to create savings jar');
      console.error('Error creating savings jar:', error);
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
      // Check chapter limit for free users
      if (user?.uid && !isPremium && completedChaptersCount >= 10) {
        setShowChapterLimitPaywall(true);
        return;
      }

      setIsReadingLoading(true);
      
      // Use the new function to get a random uncompleted book
      const book = user?.uid 
        ? await startRandomUncompletedReading(user.uid)
        : await startRandomReading(); // Fallback for users without UID
      
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
      console.log('=== handleContinueReading called ===');
      console.log('Current reading:', currentReading);
      console.log('Smart book details:', smartBookDetails);
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
      
      // Determine which book to continue with
      let bookToContinue: Book | null = null;
      
      console.log(`Smart book details - isCompleted: ${smartBookDetails.isCompleted}, hasNextChapter: ${smartBookDetails.hasNextChapter}`);
      
      if (smartBookDetails.isCompleted && smartBookDetails.hasNextChapter) {
        // Continue with next chapter
        bookToContinue = smartBookDetails.nextChapter;
        console.log(`Continuing with next chapter: ${bookToContinue?.chapter_name} (${bookToContinue?.chapter_number})`);
        
        // Update reading progress to next chapter
        if (bookToContinue) {
          console.log(`Updating reading progress to: book_id=${bookToContinue.book_id}, chapter_number=${bookToContinue.chapter_number}, chapter_name=${bookToContinue.chapter_name}`);
          await updateReading({
            book_id: bookToContinue.book_id,
            chapter_number: bookToContinue.chapter_number,
            chapter_name: bookToContinue.chapter_name
          });
          // Log the updated current reading after updateReading
          const updatedReading = await getCurrentReadingStatus();
          console.log('Updated current reading after updateReading:', updatedReading);
        }
      } else if (!smartBookDetails.isCompleted) {
        // Continue with current chapter
        bookToContinue = smartBookDetails.book;
        console.log(`Continuing with current chapter: ${bookToContinue?.chapter_name} (${bookToContinue?.chapter_number})`);
      }
      
      if (!bookToContinue) {
        setError('No chapter to continue with');
        return;
      }
      
      console.log(`Final book to continue: ${bookToContinue.chapter_name} (Chapter ${bookToContinue.chapter_number})`);
      
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
        message: `Check out this amazing savings app! 💰 Manage your savings goals with our jug system. Track your progress and build better financial habits.\n\nDownload now:\n📱 iOS: ${iosLink}\n🤖 Android: ${androidLink}`,
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
      justifyContent: 'center',
      marginBottom: 2,
    },
    jugEmoji: {
      fontSize: 36,
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

            {/* Reading Streak Card */}
            {readingStreak && (
              <View style={[
                styles.readingStreakCard,
                readingStreak.currentStreak >= 7 && { 
                  backgroundColor: 'transparent',
                  borderWidth: 0,
                  shadowOpacity: 0.15,
                  shadowRadius: 12,
                  elevation: 4
                }
              ]}>
                {readingStreak.currentStreak >= 7 ? (
                  <LinearGradient
                    colors={['#ff6b6b', '#ee5a24']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.readingStreakCard, { backgroundColor: 'transparent', borderWidth: 0 }]}
                  >
                    <View style={styles.readingStreakContent}>
                      <ThemedText style={[styles.readingStreakEmoji, { color: '#fff' }]}>🔥</ThemedText>
                      <View style={styles.readingStreakTextContainer}>
                        <ThemedText style={[styles.readingStreakLabel, { color: '#fff' }]}>Reading Streak</ThemedText>
                        <ThemedText style={[styles.readingStreakValue, { color: '#fff' }]}>{readingStreak.currentStreak} days</ThemedText>
                        <ThemedText style={[styles.readingStreakDescription, { color: '#fff', opacity: 0.9 }]}>
                          {`Longest: ${readingStreak.longestStreak} days • Total: ${readingStreak.totalDaysRead} days`}
                        </ThemedText>
                      </View>
                    </View>
                  </LinearGradient>
                ) : (
                  <View style={styles.readingStreakContent}>
                    <ThemedText style={styles.readingStreakEmoji}>
                      {readingStreak.currentStreak >= 3 ? '⚡' : '📚'}
                    </ThemedText>
                    <View style={styles.readingStreakTextContainer}>
                      <ThemedText style={styles.readingStreakLabel}>Reading Streak</ThemedText>
                      <ThemedText style={styles.readingStreakValue}>{readingStreak.currentStreak} days</ThemedText>
                      <ThemedText style={styles.readingStreakDescription}>
                        {readingStreak.currentStreak === 0 ? 'Start reading to build your streak!' :
                         readingStreak.currentStreak === 1 ? 'Great start! Keep it up!' :
                         `Longest: ${readingStreak.longestStreak} days • Total: ${readingStreak.totalDaysRead} days`}
                      </ThemedText>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Empty State or Jugs List */}
            <View style={styles.jugsHeader}>
              <ThemedText style={styles.jugsTitle}>Your Savings Jars</ThemedText>
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
                <ThemedText style={styles.addJugButtonText}>＋ Add Jar</ThemedText>
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
                    <ThemedText style={styles.placeholderText}>Add Another Jar</ThemedText>
                  </View>
                </Pressable>
              )}
            </View>

            {/* Other Action Buttons */}
            <View style={styles.actionButtonsContainer}>
              {/* Continue Reading Card or Start New Book Card */}
              {(() => {

                if (currentReading && smartBookDetails) {
                  if (currentBook) {
                    console.log('Branch: Continue Reading (currentBook exists)');
                    return (
                      <ContinueReadingCard
                        book={{ ...currentBook, images: continueImage }}
                        onPress={handleContinueReading}
                        isLoading={isReadingLoading}
                        isNextChapter={smartBookDetails.isCompleted && smartBookDetails.hasNextChapter}
                      />
                    );
                  } else {
                    console.log('Branch: Start New Book (currentBook is null, but session exists)');
                    return (
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
                    );
                  }
                } else {
                  console.log('Branch: Start Reading (no session)');
                  return (
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
                        {isReadingLoading ? '⏳ Loading...' : '📖 Start New Book'}
                      </ThemedText>
                    </Pressable>
                  );
                }
              })()}

              {/* Report Button */}
              <QuickReport 
                lifetimeData={quickReportData?.lifetime || { booksRead: 0, totalEarned: 0, chaptersRead: 0 }}
                weekData={quickReportData?.week || { booksRead: 0, totalEarned: 0, chaptersRead: 0 }}
                monthData={quickReportData?.month || { booksRead: 0, totalEarned: 0, chaptersRead: 0 }}
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
          </View>
        )}
      </ThemedView>

      {/* Add Jug Modal */}
      <RNModal visible={showAddModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ScrollView style={{ width: '100%', flex: 1, height: '80%' }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-start' }}>
            <View style={styles.modalContent}>
              <ThemedText style={styles.modalTitle}>Create New Savings Jar</ThemedText>
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

      {/* Upgrade Modal - 5 Chapters Remaining */}
      <RNModal visible={showUpgradeModal5} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>🚀 Upgrade to Premium</ThemedText>
            <ThemedText style={{ textAlign: 'center', fontSize: 16, marginBottom: 20, color: colors.textSecondary }}>
              You've completed 5 chapters! Only 5 more free chapters remaining.
            </ThemedText>
            <ThemedText style={{ textAlign: 'center', fontSize: 14, marginBottom: 20, color: colors.textSecondary }}>
              Upgrade to Premium for unlimited access to all chapters and features!
            </ThemedText>
            <View style={styles.modalButtons}>
              <Pressable 
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowUpgradeModal5(false)}
              >
                <ThemedText style={[styles.modalButtonText, styles.modalButtonTextSecondary]}>Continue Free</ThemedText>
              </Pressable>
              <Pressable 
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={() => {
                  setShowUpgradeModal5(false);
                  showPaywall();
                }}
              >
                <ThemedText style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>Upgrade Now</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </RNModal>

      {/* Upgrade Modal - 3 Chapters Remaining */}
      <RNModal visible={showUpgradeModal3} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>⚠️ Almost at the Limit</ThemedText>
            <ThemedText style={{ textAlign: 'center', fontSize: 16, marginBottom: 20, color: colors.textSecondary }}>
              You've completed 7 chapters! Only 3 more free chapters remaining.
            </ThemedText>
            <ThemedText style={{ textAlign: 'center', fontSize: 14, marginBottom: 20, color: colors.textSecondary }}>
              Don't let your reading journey stop here! Upgrade to Premium for unlimited access.
            </ThemedText>
            <View style={styles.modalButtons}>
              <Pressable 
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowUpgradeModal3(false)}
              >
                <ThemedText style={[styles.modalButtonText, styles.modalButtonTextSecondary]}>Continue Free</ThemedText>
              </Pressable>
              <Pressable 
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={() => {
                  setShowUpgradeModal3(false);
                  showPaywall();
                }}
              >
                <ThemedText style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>Upgrade Now</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </RNModal>
    </ScrollView>
  );
}

