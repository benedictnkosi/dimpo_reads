import React from 'react';
import { View, Pressable, StyleSheet, Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { Book } from '@/services/readingService';

interface ContinueReadingCardProps {
  book: Book;
  onPress: () => void;
  isLoading?: boolean;
  isNextChapter?: boolean;
}

const { width: screenWidth } = Dimensions.get('window');

export const ContinueReadingCard: React.FC<ContinueReadingCardProps> = ({
  book,
  onPress,
  isLoading = false,
  isNextChapter = false
}) => {
  const { colors, isDark } = useTheme();

  // Get image source - use book image if available, otherwise use default reading image
  const imageSource =
    typeof book.images === 'number'
      ? book.images // local require
      : book.images
      ? { uri: book.images }
      : require('@/assets/images/dimpo/reading.png');

  // Generate a gradient based on the genre
  const getGradientColors = (): [string, string] => {
    const gradients: Record<string, [string, string]> = {
      'fiction': ['#667eea', '#764ba2'],
      'non-fiction': ['#f093fb', '#f5576c'],
      'mystery': ['#4facfe', '#00f2fe'],
      'romance': ['#fa709a', '#fee140'],
      'sci-fi': ['#a8edea', '#fed6e3'],
      'fantasy': ['#ffecd2', '#fcb69f'],
      'adventure': ['#ff9a9e', '#fecfef'],
      'default': ['#667eea', '#764ba2']
    };
    
    const genre = book.genre?.toLowerCase() || 'default';
    return gradients[genre] || gradients.default;
  };

  const styles = StyleSheet.create({
    container: {
      marginBottom: 20,
      borderRadius: 20,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    },
    card: {
      flexDirection: 'row',
      minHeight: 140,
      position: 'relative',
    },
    imageContainer: {
      width: 120,
      height: 140,
      position: 'relative',
    },
    image: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    imageOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    contentContainer: {
      flex: 1,
      padding: 16,
      justifyContent: 'space-between',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    readingLevel: {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    readingLevelText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: '#fff',
      marginBottom: 6,
      lineHeight: 24,
    },
    subtitle: {
      fontSize: 14,
      color: 'rgba(255, 255, 255, 0.8)',
      marginBottom: 12,
      lineHeight: 20,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      marginBottom: 12,
    },
    stat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    statText: {
      color: 'rgba(255, 255, 255, 0.8)',
      fontSize: 12,
      fontWeight: '500',
    },
    continueButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    continueButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 6,
    },
    loadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
    },
    playIcon: {
      width: 24,
      height: 24,
      tintColor: '#fff',
    },
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={getGradientColors()}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.imageContainer}>
          <Image source={imageSource} style={styles.image} />
          <View style={styles.imageOverlay} />
        </View>
        
        <View style={styles.contentContainer}>
          <View>
            <View style={styles.header}>
              <View style={styles.readingLevel}>
                <ThemedText style={styles.readingLevelText}>
                  {book.genre || 'General'}
                </ThemedText>
              </View>
            </View>
            
            <ThemedText style={styles.title} numberOfLines={2}>
              {book.title}
            </ThemedText>
            
            <ThemedText style={styles.subtitle} numberOfLines={2}>
              {book.chapter_name}
            </ThemedText>
          </View>
          
          <View>
          
            
            <Pressable
              style={({ pressed }) => [
                styles.continueButton,
                pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }
              ]}
              onPress={onPress}
              disabled={isLoading}
            >
              <Ionicons name="play" size={16} color="#fff" />
              <ThemedText style={styles.continueButtonText}>
                {isNextChapter ? 'Next Chapter' : 'Continue Reading'}
              </ThemedText>
            </Pressable>
          </View>
        </View>
        
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <Ionicons name="hourglass-outline" size={24} color="#fff" />
          </View>
        )}
      </LinearGradient>
    </View>
  );
}; 