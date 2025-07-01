import React, { useState } from 'react';
import { View, StyleSheet, Text, Pressable, Modal, ActivityIndicator, FlatList } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { getUserCompletedChaptersWithScore } from '@/services/database';
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

  const cards = [
    {
      icon: '📚',
      label: 'Books Read',
      value: currentData.booksRead,
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
                data={booksData}
                keyExtractor={item => `${item.chapter_id}-${item.completed_at}`}
                style={{ marginTop: 12, maxHeight: 350 }}
                renderItem={({ item }) => (
                  <View style={styles.bookItem}>
                    <Text style={[styles.bookTitle, { color: isDark ? '#f7fafc' : '#1a202c' }]}>{item.genre} - {item.chapter_name}</Text>
                    <Text style={[styles.bookMeta, { color: isDark ? '#a0aec0' : '#4a5568' }]}>Completed: {new Date(item.completed_at).toLocaleDateString()} | Score: {item.score}%</Text>
                  </View>
                )}
                ListEmptyComponent={<Text style={{ color: isDark ? '#f7fafc' : '#1a202c', marginTop: 16 }}>No completed chapters found.</Text>}
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