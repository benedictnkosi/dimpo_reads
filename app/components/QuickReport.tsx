import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface QuickReportProps {
  booksRead: number;
  totalEarned: number;
  chaptersRead: number;
}

export const QuickReport: React.FC<QuickReportProps> = ({ booksRead, totalEarned, chaptersRead }) => {
  const cards = [
    {
      icon: '📚',
      label: 'Books Read',
      value: booksRead,
    },
    {
      icon: '💰',
      label: 'Total Earned',
      value: `$${totalEarned.toFixed(2)}`,
    },
    {
      icon: '📖',
      label: 'Chapters Read',
      value: chaptersRead.toLocaleString(),
    },
  ];

  return (
    <View style={styles.container}>
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
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 24,
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