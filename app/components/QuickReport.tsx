import React, { useState } from 'react';
import { View, StyleSheet, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface QuickReportProps {
  lifetimeData: {
    booksRead: number;
    totalEarned: number;
    chaptersRead: number;
  };
  weekData: {
    booksRead: number;
    totalEarned: number;
    chaptersRead: number;
  };
  monthData: {
    booksRead: number;
    totalEarned: number;
    chaptersRead: number;
  };
}

type Period = 'lifetime' | 'week' | 'month';

export const QuickReport: React.FC<QuickReportProps> = ({ 
  lifetimeData, 
  weekData, 
  monthData 
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('lifetime');

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

  const cards = [
    {
      icon: '📚',
      label: 'Books Read',
      value: currentData.booksRead,
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
      icon: '📖',
      label: 'Chapters Read',
      value: currentData.chaptersRead.toLocaleString(),
    },
  ];

  const periods: Period[] = ['lifetime', 'week', 'month'];

  return (
    <View style={styles.container}>
      {/* Period Tabs */}
      <View style={styles.tabsContainer}>
        {periods.map((period) => (
          <Pressable
            key={period}
            style={[
              styles.tab,
              selectedPeriod === period && styles.activeTab
            ]}
            onPress={() => setSelectedPeriod(period)}
          >
            <Text style={[
              styles.tabText,
              selectedPeriod === period && styles.activeTabText
            ]}>
              {getPeriodLabel(period)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Stats Cards */}
      <View style={styles.cardsContainer}>
        {cards.map((card, idx) => (
          <LinearGradient
            key={card.label}
            colors={["#f8fafc", "#f1f5fd"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            <Text style={styles.icon}>{card.icon}</Text>
            <Text style={styles.label}>{card.label}</Text>
            <Text style={styles.value}>{card.value}</Text>
          </LinearGradient>
        ))}
      </View>
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
    backgroundColor: '#f1f5f9',
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
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  activeTabText: {
    color: '#1e293b',
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
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  icon: {
    fontSize: 28,
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
    color: '#555',
    marginBottom: 2,
  },
  value: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
  },
}); 