import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { 
  ScrollView, 
  StyleSheet, 
  View, 
  Pressable, 
  TextInput, 
  Alert, 
  Modal as RNModal,
  ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/contexts/ThemeContext';
import { useDatabase } from '@/hooks/useDatabase';
import { DatabaseLoading } from '@/components/DatabaseLoading';
import { 
  getSavingsJugById,
  getSavingsTransactionsByJugId,
  deleteSavingsJug
} from '@/services/database';
import { 
  addMoneyToJug,
  removeMoneyFromJug
} from '@/services/savingsService';

interface SavingsJug {
  id: number;
  name: string;
  balance: number;
  created: string;
  updated: string;
}

interface SavingsTransaction {
  id: number;
  savings_jug_id: number;
  transaction_name: string;
  amount: number;
  date: string;
  created: string;
}

export default function JugTransactionsScreen() {
  const { jugId } = useLocalSearchParams<{ jugId: string }>();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { isInitialized, isLoading: isDatabaseLoading } = useDatabase();

  const [jug, setJug] = useState<SavingsJug | null>(null);
  const [transactions, setTransactions] = useState<SavingsTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [showAddMoneyModal, setShowAddMoneyModal] = useState(false);
  const [showRemoveMoneyModal, setShowRemoveMoneyModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Form states
  const [transactionAmount, setTransactionAmount] = useState('');
  const [transactionName, setTransactionName] = useState('');

  useEffect(() => {
    if (isInitialized && !isDatabaseLoading && jugId) {
      loadJugData();
    }
  }, [isInitialized, isDatabaseLoading, jugId]);

  const loadJugData = async () => {
    if (!jugId) return;
    
    try {
      setIsLoading(true);
      setError(null);

      const jugIdNum = parseInt(jugId);
      const jugData = await getSavingsJugById(jugIdNum);
      if (!jugData) {
        setError('Jug not found');
        return;
      }
      setJug(jugData);

      const transactionsData = await getSavingsTransactionsByJugId(jugIdNum);
      setTransactions(transactionsData);

      setIsLoading(false);
    } catch (error) {
      setError('Failed to load jug data');
      setIsLoading(false);
      console.error('Error loading jug data:', error);
    }
  };

  const handleAddMoney = async () => {
    if (!jug || !transactionAmount || !transactionName.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const amount = parseFloat(transactionAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid positive amount');
      return;
    }

    try {
      await addMoneyToJug(jug.id, amount, transactionName.trim());
      setTransactionAmount('');
      setTransactionName('');
      setShowAddMoneyModal(false);
      await loadJugData();
    } catch (error) {
      setError('Failed to add money to jug');
      console.error('Error adding money to jug:', error);
    }
  };

  const handleRemoveMoney = async () => {
    if (!jug || !transactionAmount || !transactionName.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const amount = parseFloat(transactionAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid positive amount');
      return;
    }

    if (jug.balance < amount) {
      Alert.alert('Error', 'Insufficient funds in this savings jar');
      return;
    }

    try {
      await removeMoneyFromJug(jug.id, amount, transactionName.trim());
      setTransactionAmount('');
      setTransactionName('');
      setShowRemoveMoneyModal(false);
      await loadJugData();
    } catch (error) {
      setError('Failed to withdraw from jug');
      console.error('Error withdrawing from jug:', error);
    }
  };

  const handleDeleteJug = async () => {
    if (!jug) return;

    try {
      await deleteSavingsJug(jug.id);
      setShowDeleteModal(false);
      router.back();
    } catch (error) {
      setError('Failed to delete savings jar');
      console.error('Error deleting savings jar:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Show database loading if database is not initialized
  if (!isInitialized || isDatabaseLoading) {
    return <DatabaseLoading message="Loading..." />;
  }

  if (!jugId) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.errorText}>No jug ID provided</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }}>
      <ThemedView style={styles.container}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <ThemedText style={styles.loadingText}>Loading...</ThemedText>
          </View>
        ) : error ? (
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        ) : jug ? (
          <View>
            {/* Header */}
            

            {/* Jug Info Card */}
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.jugCard}
            >
              <Pressable
                style={styles.jugBackIcon}
                onPress={() => router.back()}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </Pressable>
              <Pressable
                style={styles.jugDeleteIcon}
                onPress={() => setShowDeleteModal(true)}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${jug.name}`}
              >
                <Ionicons name="trash-outline" size={24} color="#fff" />
              </Pressable>
              <ThemedText style={styles.jugEmoji}>🐷</ThemedText>
              <ThemedText style={styles.jugName}>{jug.name}</ThemedText>
              <ThemedText style={styles.jugBalance}>{formatCurrency(jug.balance)}</ThemedText>
            </LinearGradient>

            {/* Action Button */}
            <View style={styles.actionButtonsSingle}>
              <Pressable
                style={({ pressed }) => [styles.withdrawButton, pressed && styles.withdrawButtonPressed]}
                onPress={() => setShowRemoveMoneyModal(true)}
              >
                <ThemedText style={styles.withdrawButtonText}>Withdraw Savings</ThemedText>
              </Pressable>
            </View>

            {/* Transactions List */}
            <View style={styles.transactionsContainer}>
              <ThemedText style={styles.transactionsTitle}>
                Transactions ({transactions.length})
              </ThemedText>
              {transactions.length === 0 ? (
                <View style={styles.emptyState}>
                  <ThemedText style={styles.emptyStateIcon}>📝</ThemedText>
                  <ThemedText style={styles.emptyStateText}>No transactions yet</ThemedText>
                </View>
              ) : (
                transactions.map((transaction) => (
                  <View key={transaction.id} style={styles.transactionCard}>
                    <View style={styles.transactionHeader}>
                      <ThemedText style={styles.transactionName}>
                        {transaction.transaction_name}
                      </ThemedText>
                      <ThemedText style={[
                        styles.transactionAmount,
                        { color: transaction.amount >= 0 ? '#059669' : '#dc2626' }
                      ]}>
                        {transaction.amount >= 0 ? '+' : ''}{formatCurrency(transaction.amount)}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.transactionDate}>
                      {formatDate(transaction.date)}
                    </ThemedText>
                  </View>
                ))
              )}
            </View>
          </View>
        ) : (
          <ThemedText style={styles.errorText}>Jug not found</ThemedText>
        )}
      </ThemedView>

      {/* Add Money Modal */}
      <RNModal visible={showAddMoneyModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>
              Add Money to {jug?.name}
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
              Withdraw Savings
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
                }}
              >
                <ThemedText style={[styles.modalButtonText, styles.modalButtonTextSecondary]}>Cancel</ThemedText>
              </Pressable>
              <Pressable 
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleRemoveMoney}
              >
                <ThemedText style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>Confirm</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </RNModal>

      {/* Delete Jug Modal */}
      <RNModal visible={showDeleteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Delete Savings Jar</ThemedText>
            <ThemedText style={styles.modalText}>
              Are you sure you want to delete "{jug?.name}"? This will also delete all its transactions.
            </ThemedText>
            <View style={styles.modalButtons}>
              <Pressable 
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowDeleteModal(false)}
              >
                <ThemedText style={[styles.modalButtonText, styles.modalButtonTextSecondary]}>Cancel</ThemedText>
              </Pressable>
              <Pressable 
                style={[styles.modalButton, { backgroundColor: '#dc2626' }]}
                onPress={handleDeleteJug}
              >
                <ThemedText style={[styles.modalButtonText, { color: '#fff' }]}>Delete</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </RNModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20,
    backgroundColor: '#F7F8FA',
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
  errorText: {
    color: '#dc2626',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 24,
    marginTop: 32,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    paddingLeft: 10,
  },
  jugCard: {
    marginHorizontal: 20,
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 42,
  },
  jugBackIcon: {
    position: 'absolute',
    top: 16,
    left: 16,
    padding: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.18)',
    zIndex: 2,
  },
  jugDeleteIcon: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.18)',
    zIndex: 2,
  },
  jugEmoji: {
    fontSize: 48,
    marginBottom: 12,
    paddingTop: 24,
  },
  jugName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    paddingTop: 12,
  },
  jugBalance: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    paddingTop: 12,
  },
  actionButtonsSingle: {
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  withdrawButton: {
    backgroundColor: '#dc2626',
    width: '100%',
    maxWidth: 400,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  withdrawButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  withdrawButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  transactionsContainer: {
    paddingHorizontal: 20,
  },
  transactionsTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6b7280',
  },
  transactionCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  transactionName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  transactionDate: {
    fontSize: 14,
    color: '#6b7280',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
  },
  modalText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
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
    backgroundColor: '#3b82f6',
  },
  modalButtonSecondary: {
    backgroundColor: '#e5e7eb',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextPrimary: {
    color: '#fff',
  },
  modalButtonTextSecondary: {
    color: '#374151',
  },
}); 