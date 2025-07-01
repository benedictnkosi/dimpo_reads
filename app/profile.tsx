import { UpgradeToProButton } from '@/app/components/UpgradeToProButton';
import { Header } from '@/components/Header';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { HOST_URL } from '@/config/api';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View, Alert } from 'react-native';
import Modal from 'react-native-modal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Paywall } from './components/Paywall';
import { useSound } from './contexts/SoundContext';
import { clearAllCompletedChapters, getCurrentReadingLevel } from '@/services/database';
import { reloadBooksFromJSON } from '@/services/bookService';
import { ContractAmountSelector } from './components/ContractAmountSelector';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearLearnerReadingTable } from '@/services/database';

interface ProfileInfo {
  name: string;
  email?: string;
  subscription?: 'free' | 'premium';
}

export default function ProfileScreen() {
  const { user } = useAuth();
  const { signOut } = useAuth();
  const { colors, isDark } = useTheme();
  const { soundEnabled, toggleSound } = useSound();
  const [profileInfo, setProfileInfo] = useState<ProfileInfo | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const insets = useSafeAreaInsets();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [showPaywall, setShowPaywall] = useState(false);
  const [isUpgradeLoading, setIsUpgradeLoading] = useState(false);
  const [isClearingChapters, setIsClearingChapters] = useState(false);
  const [isReloadingBooks, setIsReloadingBooks] = useState(false);
  const [showContractSelector, setShowContractSelector] = useState(false);
  const [agreedAmount, setAgreedAmount] = useState('5');
  const [currentReadingLevel, setCurrentReadingLevel] = useState<string>('');
  const [isClearingLearnerReading, setIsClearingLearnerReading] = useState(false);

  // Reading level constants
  const READING_LEVELS = {
    EXPLORER: 'Explorer',
    BUILDER: 'Builder', 
    CHALLENGER: 'Challenger'
  };

  // Helper functions to convert between numeric and text levels
  const getNumericLevel = (textLevel: string): number => {
    switch (textLevel) {
      case READING_LEVELS.EXPLORER: return 1;
      case READING_LEVELS.BUILDER: return 2;
      case READING_LEVELS.CHALLENGER: return 3;
      default: return 1;
    }
  };

  const getTextLevel = (numericLevel: number): string => {
    switch (numericLevel) {
      case 1: return READING_LEVELS.EXPLORER;
      case 2: return READING_LEVELS.BUILDER;
      case 3: return READING_LEVELS.CHALLENGER;
      default: return READING_LEVELS.EXPLORER;
    }
  };

  const handleIncrementReadingLevel = async () => {
    try {
      const currentLevelNum = getNumericLevel(currentReadingLevel);
      if (currentLevelNum < 3) {
        const newLevelNum = currentLevelNum + 1;
        const newLevelText = getTextLevel(newLevelNum);
        await AsyncStorage.setItem('readingLevel', newLevelText);
        setCurrentReadingLevel(newLevelText);
        Toast.show({
          type: 'success',
          text1: 'Reading Level Increased',
          text2: `Promoted to ${newLevelText} level`,
          position: 'top',
          topOffset: 60,
          visibilityTime: 3000,
          autoHide: true
        });
      } else {
        Toast.show({
          type: 'info',
          text1: 'Already at Max Level',
          text2: 'You are already at the highest reading level (Challenger)',
          position: 'top',
          topOffset: 60,
          visibilityTime: 3000,
          autoHide: true
        });
      }
    } catch (error) {
      console.error('Error incrementing reading level:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to increment reading level',
        position: 'top',
        topOffset: 60,
        visibilityTime: 3000,
        autoHide: true
      });
    }
  };

  const handleDecrementReadingLevel = async () => {
    try {
      const currentLevelNum = getNumericLevel(currentReadingLevel);
      if (currentLevelNum > 1) {
        const newLevelNum = currentLevelNum - 1;
        const newLevelText = getTextLevel(newLevelNum);
        await AsyncStorage.setItem('readingLevel', newLevelText);
        setCurrentReadingLevel(newLevelText);
        Toast.show({
          type: 'success',
          text1: 'Reading Level Decreased',
          text2: `Demoted to ${newLevelText} level`,
          position: 'top',
          topOffset: 60,
          visibilityTime: 3000,
          autoHide: true
        });
      } else {
        Toast.show({
          type: 'info',
          text1: 'Already at Min Level',
          text2: 'You are already at the lowest reading level (Explorer)',
          position: 'top',
          topOffset: 60,
          visibilityTime: 3000,
          autoHide: true
        });
      }
    } catch (error) {
      console.error('Error decrementing reading level:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to decrement reading level',
        position: 'top',
        topOffset: 60,
        visibilityTime: 3000,
        autoHide: true
      });
    }
  };

  const fetchLearnerData = async () => {
    try {
      const authData = await SecureStore.getItemAsync('auth');
      if (!authData) {
        throw new Error('No auth data found');
      }
      const { user } = JSON.parse(authData);

      const response = await fetch(`${HOST_URL}/api/language-learners/uid/${user.uid}`);
      if (!response.ok) {
        throw new Error('Failed to fetch learner data');
      }

      const learnerData = await response.json();
      setProfileInfo({
        name: learnerData.name,
        email: user?.email || '',
        subscription: learnerData.subscription || 'free'
      });

      //console.log('subscription', learnerData.subscription);
    } catch (error) {
      console.error('Error fetching learner data:', error);
    }
  };

  const loadAgreedAmount = async () => {
    try {
      const storedAmount = await AsyncStorage.getItem('learnerAgreedAmount');
      if (storedAmount) {
        setAgreedAmount(storedAmount);
      }
    } catch (error) {
      console.error('Error loading agreed amount:', error);
    }
  };

  const loadReadingLevel = async () => {
    try {
      const readingLevel = await getCurrentReadingLevel();
      console.log('Reading level loaded:', readingLevel);
      setCurrentReadingLevel(readingLevel);
    } catch (error) {
      console.error('Error loading reading level:', error);
      // Set default reading level even if there's an error
      setCurrentReadingLevel('Explorer');
    }
  };

  useEffect(() => {
    fetchLearnerData();
    loadAgreedAmount();
    loadReadingLevel();
  }, [user?.email]);

  const handleContractAmountChange = (newAmount: string) => {
    setAgreedAmount(newAmount);
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await signOut();
      router.replace('/login');
    } catch (error) {
      console.error('Logout error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to logout',
        position: 'bottom'
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user?.uid) return;

    setIsDeleting(true);
    try {
      // Mock successful deletion
      Toast.show({
        type: 'info',
        text1: 'Account deleted successfully',
        position: 'bottom'
      });

      setTimeout(async () => {
        await signOut();
      }, 3000);
    } catch (error) {
      console.error('Error deleting account:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to delete account',
        position: 'bottom'
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleClearCompletedChapters = async () => {
    Alert.alert(
      'Clear Completed Chapters',
      'This will permanently delete all your completed chapter records. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setIsClearingChapters(true);
            try {
              await clearAllCompletedChapters();
              Toast.show({
                type: 'success',
                text1: 'Completed chapters cleared',
                text2: 'All chapter completion records have been deleted',
                position: 'top',
                topOffset: 60,
                visibilityTime: 3000,
                autoHide: true
              });
            } catch (error) {
              console.error('Error clearing completed chapters:', error);
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to clear completed chapters',
                position: 'top',
                topOffset: 60,
                visibilityTime: 3000,
                autoHide: true
              });
            } finally {
              setIsClearingChapters(false);
            }
          }
        }
      ]
    );
  };

  const handleReloadBooks = async () => {
    Alert.alert(
      'Reload Books',
      'This will clear all existing books and reload them from books.json. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reload',
          style: 'destructive',
          onPress: async () => {
            setIsReloadingBooks(true);
            try {
              await reloadBooksFromJSON();
              Toast.show({
                type: 'success',
                text1: 'Books reloaded successfully',
                text2: 'All books have been reloaded from books.json',
                position: 'top',
                topOffset: 60,
                visibilityTime: 3000,
                autoHide: true
              });
            } catch (error) {
              console.error('Error reloading books:', error);
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to reload books',
                position: 'top',
                topOffset: 60,
                visibilityTime: 3000,
                autoHide: true
              });
            } finally {
              setIsReloadingBooks(false);
            }
          }
        }
      ]
    );
  };

  const handleClearLearnerReadingTable = async () => {
    Alert.alert(
      'Clear Learner Reading Table',
      'This will clear all current reading progress. The user will need to start reading a new book. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setIsClearingLearnerReading(true);
            try {
              await clearLearnerReadingTable();
              Toast.show({
                type: 'success',
                text1: 'Learner reading table cleared',
                text2: 'All current reading progress has been deleted',
                position: 'top',
                topOffset: 60,
                visibilityTime: 3000,
                autoHide: true
              });
            } catch (error) {
              console.error('Error clearing learner reading table:', error);
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to clear learner reading table',
                position: 'top',
                topOffset: 60,
                visibilityTime: 3000,
                autoHide: true
              });
            } finally {
              setIsClearingLearnerReading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <LinearGradient
      colors={isDark ? ['#1E1E1E', '#121212'] : ['#FFFFFF', '#F8FAFC', '#F1F5F9']}
      style={[styles.gradient]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
       <Header />
      <ScrollView
        style={styles.container}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
      >
       

        <ThemedView style={styles.content}>
          <ThemedView style={[styles.profileCard, { backgroundColor: isDark ? colors.card : '#FFFFFF' }]}>

            <View style={styles.profileHeader}>
              <View style={[styles.avatarContainer, { backgroundColor: colors.primary }]}>
                <ThemedText style={[styles.avatarText, { color: '#FFFFFF' }]}>
                  {profileInfo?.name ? profileInfo.name.charAt(0).toUpperCase() : 'U'}
                </ThemedText>
              </View>
              <View style={styles.profileDetails}>
                <ThemedText style={[styles.profileName, { color: colors.text }]}>
                  {profileInfo?.name || 'Loading...'}
                </ThemedText>
                <ThemedText style={[styles.profileEmail, { color: colors.textSecondary }]}>
                  {user?.email || 'No email available'}
                </ThemedText>
              </View>
            </View>
          </ThemedView>





          {/* Reading Levels Card */}
          <ThemedView style={[styles.settingsCard, { backgroundColor: isDark ? colors.card : '#FFFFFF' }]}>
            <ThemedText style={[styles.settingsTitle, { color: colors.text }]}>
              📚 Reading Levels
            </ThemedText>
            <View style={styles.readingLevelsContainer}>
              <View style={[
                styles.readingLevelItem,
                currentReadingLevel.toLowerCase() === 'explorer' && styles.readingLevelActive
              ]}>
                <ThemedText style={styles.levelEmoji}>🧭</ThemedText>
                <View style={styles.levelInfo}>
                  <ThemedText style={[styles.levelTitle, { color: colors.text }]}>
                    Explorer Stories
                  </ThemedText>
                  <ThemedText style={[styles.levelDescription, { color: colors.textSecondary }]}>
                    More Pictures, Shorter Words
                  </ThemedText>
                </View>
                {currentReadingLevel.toLowerCase() === 'explorer' && (
                  <ThemedText style={[styles.currentLevelBadge, { color: colors.primary }]}>
                    Current
                  </ThemedText>
                )}
              </View>

              <View style={[
                styles.readingLevelItem,
                currentReadingLevel.toLowerCase() === 'builder' && styles.readingLevelActive
              ]}>
                <ThemedText style={styles.levelEmoji}>🧱</ThemedText>
                <View style={styles.levelInfo}>
                  <ThemedText style={[styles.levelTitle, { color: colors.text }]}>
                    Builder Stories
                  </ThemedText>
                  <ThemedText style={[styles.levelDescription, { color: colors.textSecondary }]}>
                    Everyday Drama, School Life
                  </ThemedText>
                </View>
                {currentReadingLevel.toLowerCase() === 'builder' && (
                  <ThemedText style={[styles.currentLevelBadge, { color: colors.primary }]}>
                    Current
                  </ThemedText>
                )}
              </View>

              <View style={[
                styles.readingLevelItem,
                currentReadingLevel.toLowerCase() === 'challenger' && styles.readingLevelActive
              ]}>
                <ThemedText style={styles.levelEmoji}>🧗‍♂️</ThemedText>
                <View style={styles.levelInfo}>
                  <ThemedText style={[styles.levelTitle, { color: colors.text }]}>
                    Challenger Stories
                  </ThemedText>
                  <ThemedText style={[styles.levelDescription, { color: colors.textSecondary }]}>
                    More Plot, Bigger Words
                  </ThemedText>
                </View>
                {currentReadingLevel.toLowerCase() === 'challenger' && (
                  <ThemedText style={[styles.currentLevelBadge, { color: colors.primary }]}>
                    Current
                  </ThemedText>
                )}
              </View>
            </View>
          </ThemedView>

          {/* Contract Amount Card */}
          <ThemedView style={[styles.settingsCard, { backgroundColor: isDark ? colors.card : '#FFFFFF' }]}>
            <ThemedText style={[styles.settingsTitle, { color: colors.text }]}>
              💰 Contract Amount
            </ThemedText>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <ThemedText style={[styles.settingLabel, { color: colors.text }]}>
                  Earnings per Chapter
                </ThemedText>
                <ThemedText style={[styles.settingDescription, { color: colors.textSecondary }]}>
                  Currently earning {agreedAmount} per completed chapter
                </ThemedText>
              </View>
              <TouchableOpacity
                style={[
                  styles.contractButton,
                  { backgroundColor: colors.primary }
                ]}
                onPress={() => setShowContractSelector(true)}
              >
                <ThemedText style={[styles.contractButtonText, { color: '#FFFFFF' }]}>
                  Change
                </ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>

          {/* Sound Settings Card */}
          <ThemedView style={[styles.settingsCard, { backgroundColor: isDark ? colors.card : '#FFFFFF' }]}>
            <ThemedText style={[styles.settingsTitle, { color: colors.text }]}>
              🔊 Sound Settings
            </ThemedText>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <ThemedText style={[styles.settingLabel, { color: colors.text }]}>
                  Play Sound Effects
                </ThemedText>
                <ThemedText style={[styles.settingDescription, { color: colors.textSecondary }]}>
                  Hear feedback sounds when answering questions
                </ThemedText>
              </View>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  {
                    backgroundColor: soundEnabled ? colors.primary : isDark ? colors.surface : '#E5E7EB',
                    borderColor: colors.border,
                  }
                ]}
                onPress={toggleSound}
                accessibilityRole="switch"
                accessibilityState={{ checked: soundEnabled }}
                accessibilityLabel={`Sound effects ${soundEnabled ? 'enabled' : 'disabled'}`}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    {
                      backgroundColor: '#FFFFFF',
                      transform: [{ translateX: soundEnabled ? 20 : 0 }],
                    }
                  ]}
                />
              </TouchableOpacity>
            </View>
          </ThemedView>

          {/* Dev Tools Card */}
          <ThemedView style={[styles.devCard, { backgroundColor: isDark ? colors.card : '#FFFFFF' }]}>
            <ThemedText style={[styles.devTitle, { color: colors.text }]}>
              🛠️ Developer Tools
            </ThemedText>
            <ThemedText style={[styles.devDescription, { color: colors.textSecondary }]}>
              Advanced tools for development and testing
            </ThemedText>
            <TouchableOpacity
              style={[
                styles.devButton,
                { backgroundColor: isDark ? '#DC2626' : '#F43F5E' },
                isClearingChapters && styles.buttonDisabled
              ]}
              onPress={handleClearCompletedChapters}
              disabled={isClearingChapters}
            >
              <ThemedText style={[styles.devButtonText, { color: '#FFFFFF' }]}>
                {isClearingChapters ? 'Clearing...' : '🗑️ Clear Completed Chapters'}
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.devButton,
                { backgroundColor: isDark ? '#059669' : '#10B981' },
                isReloadingBooks && styles.buttonDisabled
              ]}
              onPress={handleReloadBooks}
              disabled={isReloadingBooks}
            >
              <ThemedText style={[styles.devButtonText, { color: '#FFFFFF' }]}>
                {isReloadingBooks ? 'Reloading...' : '📚 Reload Books from JSON'}
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.devButton,
                { backgroundColor: isDark ? '#3B82F6' : '#2563EB' }
              ]}
              onPress={handleIncrementReadingLevel}
            >
              <ThemedText style={[styles.devButtonText, { color: '#FFFFFF' }]}>
                ⬆️ Increment Reading Level
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.devButton,
                { backgroundColor: isDark ? '#F59E0B' : '#D97706' }
              ]}
              onPress={handleDecrementReadingLevel}
            >
              <ThemedText style={[styles.devButtonText, { color: '#FFFFFF' }]}>
                ⬇️ Decrement Reading Level
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.devButton,
                { backgroundColor: isDark ? '#8B5CF6' : '#7C3AED' },
                isClearingLearnerReading && styles.buttonDisabled
              ]}
              onPress={handleClearLearnerReadingTable}
              disabled={isClearingLearnerReading}
            >
              <ThemedText style={[styles.devButtonText, { color: '#FFFFFF' }]}>
                {isClearingLearnerReading ? 'Clearing...' : '📖 Clear Learner Reading Table'}
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>

          {/* Show Upgrade to Pro button for free users */}
          {profileInfo?.subscription === 'free' && (
            <ThemedView style={[styles.upgradeCard, { backgroundColor: isDark ? colors.card : '#FFFFFF' }]}>
              <ThemedText style={[styles.upgradeTitle, { color: colors.text }]}>
                ✨ Unlock Premium Features
              </ThemedText>
              <ThemedText style={[styles.upgradeDescription, { color: colors.textSecondary }]}>
                Get unlimited access to all lessons!
              </ThemedText>
              <UpgradeToProButton
                style={styles.upgradeButton}
                onPress={() => {
                  setIsUpgradeLoading(true);
                  setShowPaywall(true);
                }}
                loading={isUpgradeLoading}
              />
            </ThemedView>
          )}
        </ThemedView>

        <ThemedView style={styles.signOutContainer}>
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: isDark ? colors.surface : '#F8FAFC', borderColor: colors.border },
              ]}
              onPress={() => router.push('/')}
              disabled={isLoggingOut}
            >
              <ThemedText style={[styles.actionButtonText, { color: colors.text }]}>
                Close
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: isDark ? '#DC2626' : '#F43F5E' },
                isLoggingOut && styles.buttonDisabled
              ]}
              onPress={handleLogout}
              disabled={isLoggingOut}
            >
              <ThemedText style={[styles.actionButtonText, { color: '#FFFFFF' }]}>
                {isLoggingOut ? 'Signing out...' : 'Sign Out'}
              </ThemedText>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.deleteAccountButton,
              {
                backgroundColor: isDark ? colors.surface : '#FEE2E2',
                borderColor: '#DC2626'
              },
              isLoggingOut && styles.buttonDisabled
            ]}
            onPress={() => setShowDeleteModal(true)}
            disabled={isLoggingOut}
          >
            <ThemedText style={[styles.deleteAccountText, { color: '#DC2626' }]}>
              Delete Account
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ScrollView>

      {showPaywall && (
        <Paywall
          onSuccess={() => {
            setShowPaywall(false);
            setIsUpgradeLoading(false);
            // Refresh profile data after successful upgrade
            fetchLearnerData();
          }}
          onClose={() => {
            setShowPaywall(false);
            setIsUpgradeLoading(false);
          }}
        />
      )}

      <ContractAmountSelector
        isVisible={showContractSelector}
        onClose={() => setShowContractSelector(false)}
        onAmountChanged={handleContractAmountChange}
        currentAmount={agreedAmount}
      />

      <Modal
        isVisible={showDeleteModal}
        onBackdropPress={() => setShowDeleteModal(false)}
        style={styles.modal}
      >
        <View style={[styles.confirmationModal, {
          backgroundColor: isDark ? colors.card : '#FFFFFF'
        }]}>
          <View style={styles.confirmationHeader}>
            <ThemedText style={[styles.confirmationTitle, { color: colors.text }]}>Delete Account?</ThemedText>
          </View>
          <ThemedText style={[styles.confirmationText, { color: colors.textSecondary }]}>
            This action cannot be undone. All your data will be permanently deleted.
          </ThemedText>

          <View style={styles.deleteConfirmationContainer}>
            <ThemedText style={[styles.deleteConfirmationText, { color: colors.textSecondary }]}>
              Type <ThemedText style={[styles.deleteConfirmationHighlight, { color: '#DC2626' }]}>delete</ThemedText> to confirm
            </ThemedText>
            <TextInput
              style={[styles.deleteConfirmationInput, {
                backgroundColor: isDark ? colors.surface : '#F8FAFC',
                borderColor: colors.border,
                color: colors.text
              }]}
              value={deleteConfirmation}
              onChangeText={setDeleteConfirmation}
              placeholder="Type 'delete'"
              placeholderTextColor={isDark ? '#666666' : '#94A3B8'}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={50}
            />
          </View>

          <View style={styles.confirmationButtons}>
            <TouchableOpacity
              style={[styles.paperButton]}
              onPress={() => {
                setShowDeleteModal(false);
                setDeleteConfirmation('');
              }}
            >
              <LinearGradient
                colors={isDark ? ['#475569', '#334155'] : ['#64748B', '#475569']}
                style={styles.paperButtonGradient}
              >
                <ThemedText style={styles.paperButtonText}>Cancel</ThemedText>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.paperButton,
                deleteConfirmation !== 'delete' && styles.paperButtonDisabled
              ]}
              onPress={handleDeleteAccount}
              disabled={isDeleting || deleteConfirmation !== 'delete'}
            >
              <LinearGradient
                colors={['#DC2626', '#B91C1C']}
                style={styles.paperButtonGradient}
              >
                <ThemedText style={styles.paperButtonText}>
                  {isDeleting ? 'Deleting...' : 'Delete Account'}
                </ThemedText>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  content: {
    backgroundColor: 'transparent',
  },
  profileCard: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
  },
  profileDetails: {
    flexDirection: 'column',
    gap: 8,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
  },
  profileEmail: {
    fontSize: 14,
    fontWeight: '500',
  },
  signOutContainer: {
    padding: 20,
    marginTop: 20,
    backgroundColor: 'transparent',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  actionButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modal: {
    margin: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmationModal: {
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  confirmationHeader: {
    marginBottom: 16,
  },
  confirmationTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  confirmationText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  confirmationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    paddingHorizontal: 8,
  },
  paperButton: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    flex: 1,
    maxWidth: 160,
  },
  paperButtonGradient: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  paperButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  deleteAccountButton: {
    borderWidth: 1,
    padding: 16,
    borderRadius: 8,
    marginVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAccountText: {
    fontSize: 16,
    fontWeight: '600',
  },
  deleteConfirmationContainer: {
    marginVertical: 16,
    width: '100%',
  },
  deleteConfirmationText: {
    fontSize: 14,
    marginBottom: 8,
  },
  deleteConfirmationHighlight: {
    fontWeight: '600',
  },
  deleteConfirmationInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    width: '100%',
  },
  paperButtonDisabled: {
    opacity: 0.5,
  },
  upgradeCard: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  upgradeTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  upgradeDescription: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  upgradeButton: {
    marginHorizontal: 0,
    marginVertical: 0,
  },
  settingsCard: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  settingDescription: {
    fontSize: 14,
  },
  toggleButton: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
    width: 48,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  toggleButtonDisabled: {
    opacity: 0.5,
  },
  toggleButtonChecked: {
    backgroundColor: '#DC2626',
  },
  toggleThumbChecked: {
    transform: [{ translateX: 20 }],
  },
  devCard: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  devTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  devDescription: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  devButton: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  devButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  contractButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contractButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  readingLevelsContainer: {
    gap: 12,
  },
  readingLevelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 12,
  },
  readingLevelActive: {
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  levelInfo: {
    flex: 1,
  },
  levelTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  levelDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  currentLevelBadge: {
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    color: '#3B82F6',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  levelEmoji: {
    fontSize: 32,
    marginRight: 8,
    paddingTop: 18,
  },
}); 