import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, Pressable, Modal, ActivityIndicator, FlatList, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { getUserCompletedChaptersWithScore, getBookByBookIdAndChapterNumber, getBookByChapterId, getBookStatistics } from '@/services/database';
import { useAuth } from '@/contexts/AuthContext';

interface QuickReportProps {
  lifetimeData: {
    booksRead: number;
    totalEarned: number;
    totalReadingTime: number;
  };
  weekData: {
    booksRead: number;
    totalEarned: number;
    totalReadingTime: number;
  };
  monthData: {
    booksRead: number;
    totalEarned: number;
    totalReadingTime: number;
  };
}

type Period = 'lifetime' | 'week' | 'month';

// Add a type for completed book
interface CompletedBook {
  book_id: string;
  title: string;
  image: string | null;
  completed_at: string;
}

// Add a type for book info from getBookByChapterId
interface BookInfo {
  id: number;
  book_id: string;
  title: string | null;
  genre: string;
  sub_genre: string;
  chapter_number: number;
  chapter_name: string;
  content: string;
  quiz: string | null;
  images: string | null;
  word_count: number;
  reading_level: string;
  created: string;
  updated: string;
}

export const QuickReport: React.FC<QuickReportProps> = ({ 
  lifetimeData, 
  weekData, 
  monthData 
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('lifetime');
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [showBooksModal, setShowBooksModal] = useState(false);
  const [booksData, setBooksData] = useState<any[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookTitles, setBookTitles] = useState<{ [key: string]: string }>({});
  const [completedBooks, setCompletedBooks] = useState<CompletedBook[]>([]);
  const [totalBooks, setTotalBooks] = useState<number | null>(null);

  const getDataForPeriod = (period: Period) => {
    switch (period) {
      case 'lifetime':
        return lifetimeData;
      case 'week':
        return weekData;
      case 'month':
        return monthData;
      default:
        return lifetimeData;
    }
  };

  const getPeriodLabel = (period: Period) => {
    switch (period) {
      case 'lifetime':
        return 'All Time';
      case 'week':
        return 'This Week';
      case 'month':
        return 'This Month';
      default:
        return 'All Time';
    }
  };

  const currentData = getDataForPeriod(selectedPeriod);

  // Helper function to format reading time
  const formatReadingTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes}m`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      if (minutes === 0) {
        return `${hours}h`;
      } else {
        return `${hours}h ${minutes}m`;
      }
    }
  };

  // Fetch completed chapters/books for modal
  const fetchBooksData = async () => {
    if (!user) return;
    setLoadingBooks(true);
    setError(null);
    try {
      const chapters = await getUserCompletedChaptersWithScore(user.uid, 0); // show all scores
      setBooksData(chapters);
    } catch (e) {
      setError('Failed to load completed books.');
    } finally {
      setLoadingBooks(false);
    }
  };

  useEffect(() => {
    const fetchTitles = async () => {
      if (!booksData || booksData.length === 0) return;
      const titles: { [key: string]: string } = {};
      for (const item of booksData) {
        try {
          const book = await getBookByBookIdAndChapterNumber(item.book_id, item.chapter_number);
          const title = book && book.title ? book.title : item.book_id;
          titles[`${item.book_id}-${item.chapter_number}`] = title;
          console.log('Book item:', item, 'Fetched title:', title);
        } catch (e) {
          titles[`${item.book_id}-${item.chapter_number}`] = item.book_id;
          console.log('Book item:', item, 'Fetched title: ERROR');
        }
      }
      setBookTitles(titles);
    };
    fetchTitles();
  }, [booksData]);

  useEffect(() => {
    const processCompletedBooks = async () => {
      if (!booksData || booksData.length === 0) return;
      // Group by book_id
      const booksMap: { [bookId: string]: any } = {};
      for (const item of booksData) {
        if (!booksMap[item.book_id]) {
          booksMap[item.book_id] = { chapters: [], book_id: item.book_id };
        }
        booksMap[item.book_id].chapters.push(item);
      }
      const completedBooksArr = [];
      for (const bookId in booksMap) {
        const chapters = booksMap[bookId].chapters;
        // Find chapter 1 and chapter 5
        const chapter1 = chapters.find((ch: any) => ch.chapter_number === 1);
        const chapter5 = chapters.find((ch: any) => ch.chapter_number === 5);
        if (chapter1 && chapter5) {
          // Fetch book title and image for chapter 1
          const bookInfo = await getBookByChapterId(chapter1.chapter_id) as BookInfo | null;
          let title = bookInfo && bookInfo.title ? bookInfo.title : bookId;
          let image: string | null = null;
          if (bookInfo && bookInfo.images) {
            try {
              const imagesObj = JSON.parse(bookInfo.images);
              image = imagesObj.chapter_cover || null;
            } catch {}
          }
          completedBooksArr.push({
            book_id: bookId,
            title,
            image,
            completed_at: chapter5.completed_at
          });
        }
      }
      setCompletedBooks(completedBooksArr);
    };
    processCompletedBooks();
  }, [booksData]);

  useEffect(() => {
    // Fetch total books on mount
    const fetchTotalBooks = async () => {
      try {
        const stats = await getBookStatistics();
        setTotalBooks(stats.total_books);
      } catch (e) {
        setTotalBooks(null);
      }
    };
    fetchTotalBooks();
  }, []);

  const cards = [
    {
      icon: '📚',
      label: 'Books Read',
      value: totalBooks !== null ? `${currentData.booksRead} / ${totalBooks}` : currentData.booksRead,
      onPress: () => {
        setShowBooksModal(true);
        fetchBooksData();
      },
    },
    {
      icon: '💰',
      label: 'Total Earned',
      value: currentData.totalEarned.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
    },
    {
      icon: '⏱️',
      label: 'Time Read',
      value: formatReadingTime(currentData.totalReadingTime),
    },
  ];

  const periods: Period[] = ['lifetime', 'week', 'month'];

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#181c22' : 'transparent' }]}>
      {/* Period Tabs */}
      <View style={[
        styles.tabsContainer,
        { backgroundColor: isDark ? '#23272f' : '#e2e8f0' }
      ]}>
        {periods.map((period) => (
          <Pressable
            key={period}
            style={[
              styles.tab,
              selectedPeriod === period && [
                styles.activeTab,
                { 
                  backgroundColor: isDark ? '#313543' : '#f8fafc',
                  shadowOpacity: isDark ? 0.18 : 0.08
                }
              ]
            ]}
            onPress={() => setSelectedPeriod(period)}
          >
            <Text style={[
              styles.tabText,
              { color: isDark ? '#a0aec0' : '#64748b' },
              selectedPeriod === period && [
                styles.activeTabText,
                { color: isDark ? '#f7fafc' : '#1a202c' }
              ]
            ]}>
              {getPeriodLabel(period)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Stats Cards */}
      <View style={styles.cardsContainer}>
        {cards.map((card, idx) => {
          const CardContent = (
            <LinearGradient
              key={card.label}
              colors={isDark ? ["#23272f", "#313543"] : ["#f8fafc", "#e2e8f0"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.card,
                {
                  backgroundColor: isDark ? '#23272f' : '#f8fafc',
                  shadowColor: '#000',
                  shadowOpacity: isDark ? 0.18 : 0.08,
                  borderWidth: 1,
                  borderColor: isDark ? '#313543' : '#e2e8f0',
                }
              ]}
            >
              <Text style={[styles.icon, { color: isDark ? '#f7fafc' : '#1a202c' }]}>{card.icon}</Text>
              <Text style={[
                styles.label,
                { color: isDark ? '#a0aec0' : '#4a5568' }
              ]}>{card.label}</Text>
              <Text style={[
                styles.value,
                { color: isDark ? '#f7fafc' : '#1a202c' }
              ]}>{card.value}</Text>
            </LinearGradient>
          );
          if (card.label === 'Books Read') {
            return (
              <Pressable key={card.label} onPress={card.onPress} style={{ flex: 1, marginHorizontal: 4 }}>
                {CardContent}
              </Pressable>
            );
          }
          return (
            <View key={card.label} style={{ flex: 1, marginHorizontal: 4 }}>
              {CardContent}
            </View>
          );
        })}
      </View>

      {/* Books Read Modal */}
      <Modal
        visible={showBooksModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBooksModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#23272f' : '#fff' }]}> 
            <Text style={[styles.modalTitle, { color: isDark ? '#f7fafc' : '#1a202c' }]}>Books & Chapters Completed</Text>
            <Pressable style={styles.closeButton} onPress={() => setShowBooksModal(false)}>
              <Text style={{ fontSize: 18, color: isDark ? '#f7fafc' : '#1a202c' }}>✕</Text>
            </Pressable>
            {loadingBooks ? (
              <ActivityIndicator size="large" color={isDark ? '#f7fafc' : '#23272f'} />
            ) : error ? (
              <Text style={{ color: 'red', marginTop: 16 }}>{error}</Text>
            ) : (
              <FlatList
                data={completedBooks}
                keyExtractor={item => item.book_id}
                style={{ marginTop: 12, maxHeight: 350 }}
                renderItem={({ item }) => (
                  <View style={styles.bookItem}>
                    {item.image && (
                      <Image source={{ uri: item.image }} style={{ width: 60, height: 80, borderRadius: 8, marginBottom: 8 }} />
                    )}
                    <Text style={[styles.bookTitle, { color: isDark ? '#f7fafc' : '#1a202c' }]}>{item.title}</Text>
                    <Text style={[styles.bookMeta, { color: isDark ? '#a0aec0' : '#4a5568' }]}>Completed: {new Date(item.completed_at).toLocaleDateString()}</Text>
                  </View>
                )}
                ListEmptyComponent={<Text style={{ color: isDark ? '#f7fafc' : '#1a202c', marginTop: 16 }}>No completed books found.</Text>}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 24,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeTab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  activeTabText: {
    fontWeight: '600',
  },
  cardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  card: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  icon: {
    fontSize: 28,
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
    marginBottom: 2,
  },
  value: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    padding: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  bookItem: {
    marginBottom: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.04)',
    width: '100%',
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  bookMeta: {
    fontSize: 13,
    marginTop: 2,
  },
}); 