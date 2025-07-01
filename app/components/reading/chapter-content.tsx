import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, NativeSyntheticEvent, NativeScrollEvent, Pressable, Image, Animated } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { HOST_URL } from '@/config/api';
import { analytics } from '@/services/analytics';
import { useAuth } from '@/contexts/AuthContext';
import { getLearner } from '@/services/api';
import { getCurrentReadingLevel } from '@/services/database';
import { router } from 'expo-router';

interface ChapterContentProps {
    chapterName: string;
    chapterNumber: number;
    content: string;
    fontSize?: number;
    onProgress?: (progress: number) => void;
    onStartQuiz?: (wordCount: number, readingSpeed: number) => void;
    onClose?: () => void;
    image1?: string; // URL for first image placeholder
    image2?: string; // URL for second image placeholder
    readingLevel?: string; // Add reading level prop
}

function removeDoubleAsteriskText(text: string): string {
    return text.replace(/\*\*.*?\*\*/g, '');
}

// Helper function for safe analytics logging
async function logAnalyticsEvent(eventName: string, eventParams?: Record<string, any>) {
    try {
        await analytics.track(eventName, eventParams);
    } catch (error) {
        console.error('[Analytics] Error logging event:', error);
    }
}

export function ChapterContent({ chapterName, chapterNumber, content, fontSize = 18, onProgress, onStartQuiz, onClose, image1, image2, readingLevel }: ChapterContentProps) {
    const { colors } = useTheme();
    const { user } = useAuth();
    const [localProgress, setLocalProgress] = useState(0);
    const [hasStartedReading, setHasStartedReading] = useState(false);
    const [isFreeUser, setIsFreeUser] = useState(true);
    const [showQuizButton, setShowQuizButton] = useState(false);
    const [currentReadingLevel, setCurrentReadingLevel] = useState<string>('Explorer');
    const fadeAnim = useState(new Animated.Value(0))[0];
    const scaleAnim = useState(new Animated.Value(0.8))[0];
    const startTimeRef = useRef<number>(Date.now());
    const [image1Url, setImage1Url] = useState<string | null>(null);
    const [image2Url, setImage2Url] = useState<string | null>(null);

    // Calculate word count from content
    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;

    // Get current reading level
    useEffect(() => {
        const loadReadingLevel = async () => {
            try {
                const readingLevel = await getCurrentReadingLevel();
                setCurrentReadingLevel(readingLevel);
            } catch (error) {
                console.error('Error loading reading level:', error);
                setCurrentReadingLevel('Explorer');
            }
        };
        loadReadingLevel();
        
        // Log chapter view event
        logAnalyticsEvent('chapter_view', {
            chapter_name: chapterName,
            chapter_number: chapterNumber
        });
    }, []);

    // Get reading level emoji and description
    const getReadingLevelInfo = (level: string) => {
        switch (level) {
            case 'Explorer':
                return { emoji: '🧭', description: 'Beginner stories with simple words' };
            case 'Builder':
                return { emoji: '🧱', description: 'Slightly more complex phrasing, idioms' };
            case 'Challenger':
                return { emoji: '🧗‍♂️', description: 'More plot, bigger words' };
            default:
                return { emoji: '📖', description: 'Reading level' };
        }
    };

    // Calculate font size and spacing based on reading level
    const getTextStyles = () => {
        const isExplorer = currentReadingLevel === 'Explorer';
        
        return {
            fontSize: isExplorer ? Math.max(fontSize + 4, 22) : fontSize,
            lineHeight: isExplorer ? Math.max(fontSize + 8, 30) : fontSize + 6,
            letterSpacing: isExplorer ? 0.5 : 0,
            marginBottom: isExplorer ? 16 : 12,
        };
    };

    // Calculate container styles based on reading level
    const getContainerStyles = () => {
        const isExplorer = currentReadingLevel === 'Explorer';
        
        return {
            paddingTop: isExplorer ? 12 : 8,
            paddingHorizontal: isExplorer ? 16 : 12,
            paddingBottom: isExplorer ? 24 : 20,
            gap: isExplorer ? 12 : 8,
        };
    };

    // Calculate chapter name styles based on reading level
    const getChapterNameStyles = () => {
        const isExplorer = currentReadingLevel === 'Explorer';
        
        return {
            fontSize: isExplorer ? 26 : 22,
            fontWeight: 'bold' as const,
            textAlign: 'center' as const,
            flexShrink: 1,
            marginBottom: isExplorer ? 8 : 4,
            marginTop: 16,
        };
    };

    useEffect(() => {
        if (!user?.uid) return;
        getLearner(user.uid).then(learner => {
            setIsFreeUser((learner as any).subscription === 'free');
        }).catch(error => {
            console.error('Error fetching learner info:', error);
        });
    }, [user?.uid]);

    // Fetch remote images for placeholders
    useEffect(() => {
        const fetchImage = async (imageName: string | undefined, setImageUrl: (url: string | null) => void) => {
            if (!imageName) return;
            
            try {
                const imageUrl = `${HOST_URL}/public/learn/book/get-image?image=${imageName}`;
                console.log('imageUrl', imageUrl);
                const response = await fetch(imageUrl, { method: 'HEAD' });
                if (response.ok) {
                    setImageUrl(imageUrl);
                } else {
                    console.warn(`Image not found: ${imageName}`);
                    setImageUrl(null);
                }
            } catch (error) {
                console.warn(`Failed to fetch image ${imageName}:`, error);
                setImageUrl(null);
            }
        };

        fetchImage(image1, setImage1Url);
        fetchImage(image2, setImage2Url);
    }, [image1, image2]);

    // Handle quiz button visibility with animation
    useEffect(() => {
        if (localProgress >= 0.9 && onStartQuiz && !showQuizButton) {
            setShowQuizButton(true);
            // Small delay before starting animation
            setTimeout(() => {
                Animated.parallel([
                    Animated.timing(fadeAnim, {
                        toValue: 1,
                        duration: 500,
                        useNativeDriver: false,
                    }),
                    Animated.timing(scaleAnim, {
                        toValue: 1,
                        duration: 500,
                        useNativeDriver: false,
                    })
                ]).start();
            }, 300);
        }
    }, [localProgress, onStartQuiz, showQuizButton, fadeAnim, scaleAnim]);

    function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        const totalScrollable = contentSize.height - layoutMeasurement.height;

        // Log reading start event when user first scrolls
        if (!hasStartedReading && contentOffset.y > 0) {
            setHasStartedReading(true);
            logAnalyticsEvent('reading_started', {
                chapter_name: chapterName,
                chapter_number: chapterNumber
            });
        }

        if (totalScrollable <= 0) {
            onProgress?.(1);
            setLocalProgress(1);
            return;
        }
        const progress = Math.min(1, Math.max(0, contentOffset.y / totalScrollable));
        onProgress?.(progress);
        setLocalProgress(progress);
    }

    const handleStartQuiz = () => {
        console.log('Quiz button pressed!'); // Debug log
        
        // Calculate reading duration
        const endTime = Date.now();
        const readingDuration = endTime - startTimeRef.current;
        const readingDurationSeconds = Math.round(readingDuration / 1000);
        
        // Calculate reading speed (words per minute)
        const readingSpeedWPM = Math.round((wordCount / readingDurationSeconds) * 60);
        
        logAnalyticsEvent('quiz_started', {
            chapter_name: chapterName,
            chapter_number: chapterNumber,
            reading_progress: localProgress,
            word_count: wordCount,
            reading_duration_seconds: readingDurationSeconds,
            reading_speed_wpm: readingSpeedWPM
        });
        
        console.log(`Reading duration: ${readingDurationSeconds} seconds`);
        console.log(`Reading speed: ${readingSpeedWPM} words per minute`);
        
        onStartQuiz?.(wordCount, readingSpeedWPM);
    };

    // Function to process content and replace image placeholders with actual images
    const processContentWithImages = (content: string): React.ReactNode[] => {
        let workingContent = content;

        // Remove all placeholders from the content
        workingContent = workingContent.replace(/\[IMAGE_PLACEHOLDER_1\]/g, '');
        workingContent = workingContent.replace(/\[IMAGE_PLACEHOLDER_2\]/g, '');

        // Insert [IMAGE_PLACEHOLDER_2] in the middle (after nearest \n\n)
        let contentWithImage2 = workingContent;
        if (image2Url) {
            // Find all \n\n positions
            const doubleNewlineMatches = [...workingContent.matchAll(/\n\n/g)].map(m => m.index!);
            if (doubleNewlineMatches.length > 0) {
                // Find the one closest to the middle
                const middle = Math.floor(workingContent.length / 2);
                let closest = doubleNewlineMatches[0];
                let minDist = Math.abs(closest - middle);
                for (const idx of doubleNewlineMatches) {
                    const dist = Math.abs(idx - middle);
                    if (dist < minDist) {
                        closest = idx;
                        minDist = dist;
                    }
                }
                // Insert [IMAGE_PLACEHOLDER_2] after this \n\n
                contentWithImage2 =
                    workingContent.slice(0, closest + 2) + // +2 to go after the \n\n
                    '\n[IMAGE_PLACEHOLDER_2]\n' +
                    workingContent.slice(closest + 2);
            } else {
                // If no \n\n found, just append to the middle
                const middle = Math.floor(workingContent.length / 2);
                contentWithImage2 =
                    workingContent.slice(0, middle) +
                    '\n[IMAGE_PLACEHOLDER_2]\n' +
                    workingContent.slice(middle);
            }
        }

        // Log the final content after image logic
        console.log('[ChapterContent] Final content after image logic:', contentWithImage2);

        // Split for rendering
        const parts = contentWithImage2.split(/(\[IMAGE_PLACEHOLDER_2\])/);
        const result: React.ReactNode[] = [];

        parts.forEach((part, index) => {
            if (part === '[IMAGE_PLACEHOLDER_2]') {
                if (image2Url) {
                    result.push(
                        <Image
                            key={`img-2-${index}`}
                            source={{ uri: image2Url }}
                            style={{ width: '100%', height: 200, borderRadius: 12, marginVertical: 16 }}
                            resizeMode="cover"
                        />
                    );
                }
            } else if (part.trim().length > 0) {
                result.push(
                    <Text
                        key={`text-${index}`}
                        style={[styles.content, { color: colors.text, ...getTextStyles() }]}
                        accessibilityLabel={removeDoubleAsteriskText(part)}
                    >
                        {removeDoubleAsteriskText(part)}
                    </Text>
                );
            }
        });

        return result;
    };

    // Always show image1 at the top if present
    const shouldShowImage1AtTop = !!image1Url;

    // Get the reading level to display (use prop if available, otherwise use current user level)
    const displayReadingLevel = readingLevel || currentReadingLevel;
    const readingLevelInfo = getReadingLevelInfo(displayReadingLevel);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[styles.contentContainer, getContainerStyles()]}
                showsVerticalScrollIndicator={true}
                accessibilityRole="scrollbar"
                onScroll={handleScroll}
                scrollEventThrottle={16}
            >
                <View style={styles.chapterHeader}>
                    <View style={styles.closeButtonContainer}>
                        <Pressable
                            style={({ pressed }) => [
                                styles.closeButton,
                                {
                                    opacity: pressed ? 0.7 : 1,
                                    transform: [{ scale: pressed ? 0.95 : 1 }]
                                }
                            ]}
                            onPress={() => router.back()}
                            accessibilityRole="button"
                            accessibilityLabel="Close chapter"
                        >
                            <Text style={[styles.closeIcon, { color: colors.primary }]}>✕</Text>
                        </Pressable>
                    </View>
                    
                    <Text
                        style={[styles.chapterName, { color: colors.primary }, getChapterNameStyles()]}
                        accessibilityRole="header"
                        accessibilityLabel={`Chapter: ${chapterName}`}
                    >
                        {chapterName}
                    </Text>

                    {/* Reading Level Display */}
                    <View style={styles.readingLevelContainer}>
                        <View style={[styles.readingLevelBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <Text style={styles.readingLevelEmoji}>{readingLevelInfo.emoji}</Text>
                            <Text style={[styles.readingLevelText, { color: colors.text }]}>{displayReadingLevel}</Text>
                        </View>
                        <Text style={[styles.readingLevelDescription, { color: colors.textSecondary }]}>
                            {readingLevelInfo.description}
                        </Text>
                    </View>
                </View>

                {/* Always show first image at the beginning if present */}
                {shouldShowImage1AtTop && (
                    <Image
                        source={{ uri: image1Url! }}
                        style={{ width: '100%', height: 200, borderRadius: 12, marginVertical: 16 }}
                        resizeMode="cover"
                    />
                )}

                {processContentWithImages(content)}
                
                {/* Quiz button inside scroll content */}
                {onStartQuiz && showQuizButton && (
                    <View style={styles.buttonContainer}>
                        <Animated.View style={{
                            opacity: fadeAnim,
                            transform: [{ scale: scaleAnim }]
                        }}>
                            <Pressable
                                style={({ pressed }) => [
                                    styles.quizButton, 
                                    { 
                                        backgroundColor: colors.primary,
                                        opacity: pressed ? 0.8 : 1,
                                        transform: [{ scale: pressed ? 0.95 : 1 }]
                                    }
                                ]}
                                onPress={handleStartQuiz}
                                accessibilityRole="button"
                            >
                                <Text style={[styles.quizButtonText, { color: colors.background }]}>Take a Quick Quiz</Text>
                            </Pressable>
                        </Animated.View>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        borderRadius: 16,
        position: 'relative',
        paddingTop: 32,
    },
    closeButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(0, 0, 0, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    closeIcon: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    scrollView: {
        flex: 1,
    },
    contentContainer: {
        // Dynamic values applied via getContainerStyles()
    },
    chapterName: {
        // Dynamic values applied via getChapterNameStyles()
    },
    content: {
        textAlign: 'left',
        fontWeight: '400',
    },
    buttonContainer: {
        padding: 16,
        backgroundColor: 'transparent',
        marginTop: 20,
    },
    quizButton: {
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 16,
        alignItems: 'center',
        minWidth: 200,
        alignSelf: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    quizButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    chapterHeader: {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 4,
        position: 'relative',
    },
    closeButtonContainer: {
        position: 'absolute',
        top: -8,
        right: 0,
        zIndex: 1,
    },
    readingLevelContainer: {
        flexDirection: 'column',
        alignItems: 'center',
        marginTop: 8,
        gap: 4,
    },
    readingLevelBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderRadius: 20,
        gap: 6,
    },
    readingLevelEmoji: {
        fontSize: 18,
    },
    readingLevelText: {
        fontSize: 14,
        fontWeight: '600',
    },
    readingLevelDescription: {
        fontSize: 12,
        fontWeight: '400',
        textAlign: 'center',
        opacity: 0.8,
    },
}); 