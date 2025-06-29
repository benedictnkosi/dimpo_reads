import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Animated, useColorScheme, Image, Modal } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { HOST_URL } from '@/config/api';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { analytics } from '@/services/analytics';
import { Ionicons } from '@expo/vector-icons';
import { getBookByChapterId, insertChapterCompletion, getAllSavingsJugs } from '@/services/database';
import { addMoneyToJug } from '@/services/savingsService';
import ConfettiCannon from 'react-native-confetti-cannon';
import { Audio } from 'expo-av';

interface BookQuizProps {
    chapterId: number;
    startTime?: number; // Make startTime optional since we're removing reading speed
    onClose?: (shouldRetry?: boolean) => void;
    wordCount?: number; // Add wordCount prop
    onQuizStart?: () => void; // Callback to notify parent to stop timer
}

interface QuizQuestion {
    question: string;
    options: string[];
    correct: number; // Index of the correct answer
}

interface QuizData {
    chapterId: number;
    chapterName: string;
    quiz: QuizQuestion[];
    wordCount?: number; // Add wordCount to QuizData
}

interface SavingsJug {
    id: number;
    name: string;
    balance: number;
    created: string;
    updated: string;
}

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export function BookQuiz({ chapterId, startTime, onClose, wordCount, onQuizStart }: BookQuizProps) {
    const { colors } = useTheme();
    const colorScheme = useColorScheme();
    const { user } = useAuth();
    const isDark = colorScheme === 'dark';
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [quiz, setQuiz] = useState<QuizData | null>(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [showFeedback, setShowFeedback] = useState(false);
    const [score, setScore] = useState(0);
    const [showResults, setShowResults] = useState(false);
    const [isCompleting, setIsCompleting] = useState(false);
    const [quizStartTime, setQuizStartTime] = useState<number>(Date.now());
    
    // New state for savings jar selection
    const [showJarSelection, setShowJarSelection] = useState(false);
    const [savingsJugs, setSavingsJugs] = useState<SavingsJug[]>([]);
    const [selectedJugId, setSelectedJugId] = useState<number | null>(null);
    const [isAddingMoney, setIsAddingMoney] = useState(false);
    const [hasEarnedMoney, setHasEarnedMoney] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);

    useEffect(() => {
        if (chapterId) {
            // Notify parent to stop timer
            if (typeof onQuizStart === 'function') onQuizStart();

            analytics.track('reading_quiz_started', {
                userId: user?.uid,
                chapterId
            });
            fetchQuiz();
        }
    }, [chapterId]);

    async function fetchQuiz() {
        if (!chapterId) {
            setError('Invalid chapter ID');
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const bookData = await getBookByChapterId(chapterId);
            console.log('Loaded chapter data:', bookData); // DEBUG LOG
            
            if (bookData && bookData.quiz) {
                // Parse the quiz string into an array of questions
                const parsedQuiz = JSON.parse(bookData.quiz);
                // Shuffle options for each question
                const shuffledQuestions = parsedQuiz.questions.map((q: any) => ({
                    ...q,
                    options: shuffleArray(q.options),
                }));
                setQuiz({
                    chapterId: bookData.id,
                    chapterName: bookData.chapter_name,
                    quiz: shuffledQuestions,
                    wordCount: bookData.word_count || wordCount // Use wordCount from database or prop
                });
                setQuizStartTime(Date.now());
                
                // Fetch chapter image if available
                
            } else {
                setError('Quiz not available for this chapter.');
            }
        } catch (e) {
            console.error('Error fetching quiz from database:', e);
            setError('Failed to load quiz from database.');
        } finally {
            setIsLoading(false);
        }
    }

    async function completeChapter(percentage: number) {
        if (!user?.uid || !chapterId) return;

        setIsCompleting(true);
        try {
            await insertChapterCompletion({
                learnerUid: user.uid,
                chapterId,
                duration: 0,
                score: Math.floor(percentage),
            });
        } catch (error) {
            console.error('Error completing chapter:', error);
        } finally {
            setIsCompleting(false);
        }
    }

    // Load savings jugs for jar selection
    const loadSavingsJugs = async () => {
        try {
            const jugs = await getAllSavingsJugs();
            setSavingsJugs(jugs);
        } catch (error) {
            console.error('Error loading savings jugs:', error);
        }
    };

    // Add money to selected jug
    const handleAddMoneyToJug = async () => {
        if (!selectedJugId) return;

        setIsAddingMoney(true);
        try {
            await addMoneyToJug(selectedJugId, 5, `Quiz reward - ${quiz?.chapterName || 'Chapter quiz'}`);
            // Play money sound
            const { sound } = await Audio.Sound.createAsync(
                require('../../../assets/audio/money.mp3')
            );
            await sound.playAsync();
            setShowJarSelection(false);
            setSelectedJugId(null);
            setHasEarnedMoney(true);
            setShowConfetti(true);
            setTimeout(() => {
                setShowConfetti(false);
                onClose?.(false);
            }, 2200); // Confetti duration + buffer
        } catch (error) {
            console.error('Error adding money to jug:', error);
        } finally {
            setIsAddingMoney(false);
        }
    };

    // Helper to get the correct answer index for a question
    const getCorrectIndex = (question: any) => {
        if (typeof question.correct === 'number') return question.correct;
        if (question.correct_answer) {
            return question.options.findIndex((opt: string) => opt === question.correct_answer);
        }
        return -1;
    };

    function handleSelect(qid: number, option: string) {
        if (!quiz?.quiz[currentQuestionIndex]) return;

        setAnswers(a => ({ ...a, [qid]: option }));
        setShowFeedback(true);
        const currentQuestion = quiz.quiz[currentQuestionIndex];
        const isCorrect = option === currentQuestion.options[getCorrectIndex(currentQuestion)];
        if (isCorrect) {
            setScore(prev => prev + 1);
        }
        // Play correct/wrong sound
        (async () => {
            try {
                const { sound } = await Audio.Sound.createAsync(
                    isCorrect
                        ? require('../../../assets/audio/correct.mp3')
                        : require('../../../assets/audio/wrong.mp3')
                );
                await sound.playAsync();
            } catch (e) {
                console.warn('Failed to play answer sound', e);
            }
        })();
    }

    function handleNext() {
        if (!quiz?.quiz) return;

        if (currentQuestionIndex < quiz.quiz.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setShowFeedback(false);
        } else {
            const percentage = (score / quiz.quiz.length) * 100;
            
            
            // Check if user earned money (80% or higher)
            if (percentage >= 80) {
                completeChapter(percentage);
                setHasEarnedMoney(true);
                loadSavingsJugs();
                setShowJarSelection(true);
            } else {
                setShowResults(true);
            }

            // Enhanced quiz completion analytics
            analytics.track('reading_quiz_completed', {
                userId: user?.uid,
                chapterId,
                chapterName: quiz.chapterName,
                score,
                totalQuestions: quiz.quiz.length,
                percentage,
                duration: Math.floor((Date.now() - quizStartTime) / 1000),
                performance: percentage >= 90 ? 'excellent' :
                    percentage >= 75 ? 'good' :
                        percentage >= 60 ? 'average' : 'needs_improvement',
                correctAnswers: score,
                incorrectAnswers: quiz.quiz.length - score,
                timePerQuestion: Math.floor((Date.now() - quizStartTime) / 1000 / quiz.quiz.length)
            });
        }
    }

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.errorContainer}>
                <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
            </View>
        );
    }

    if (!quiz?.quiz?.length) {
        return (
            <View style={styles.errorContainer}>
                <Text style={[styles.error, { color: colors.error }]}>No questions available.</Text>
            </View>
        );
    }

    const currentQuestion = quiz.quiz[currentQuestionIndex];
    if (!currentQuestion) return null;

    const progress = ((currentQuestionIndex + 1) / quiz.quiz.length) * 100;
    const isCorrect = answers[currentQuestionIndex] === currentQuestion.options[getCorrectIndex(currentQuestion)];

    // Dynamic colors
    const cardBg = isDark ? '#181A20' : '#fff';
    const gradientColors: [string, string] = isDark
        ? ['rgba(124,58,237,0.18)', 'rgba(124,58,237,0.08)']
        : ['rgba(124,58,237,0.10)', 'rgba(124,58,237,0.05)'];
    const optionBg = isDark ? '#23242A' : '#F3F4F6';
    const optionText = isDark ? '#E5E7EB' : '#374151';
    const borderColor = isDark ? '#33364A' : '#E5E7EB';
    const progressBg = isDark ? '#23242A' : '#F3F4F6';
    const progressBar = isDark ? '#A78BFA' : '#7C3AED';
    const correctBg = isDark ? 'rgba(34,197,94,0.18)' : 'rgba(34,197,94,0.15)';
    const correctBorder = isDark ? 'rgba(34,197,94,0.5)' : 'rgba(34,197,94,0.5)';
    const correctText = isDark ? '#4ADE80' : '#16A34A';
    const wrongBg = isDark ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.15)';
    const wrongBorder = isDark ? 'rgba(239,68,68,0.5)' : 'rgba(239,68,68,0.5)';
    const wrongText = isDark ? '#F87171' : '#DC2626';
    const feedbackBadgeBg = (isCorrect: boolean) => isCorrect ? correctBg : wrongBg;
    const feedbackBadgeText = (isCorrect: boolean) => isCorrect ? correctText : wrongText;
    const nextButtonGradient: [string, string] = isDark ? ['#7C3AED', '#6366F1'] : [colors.primary, `${colors.primary}CC`];
    const shadow = isDark ? {} : styles.lightShadow;

    const getOptionStyle = (opt: string) => {
        if (!showFeedback) {
            return answers[currentQuestionIndex] === opt
                ? { backgroundColor: progressBar, transform: [{ scale: 1.02 }] }
                : { backgroundColor: optionBg, borderColor, borderWidth: 1 };
        }
        if (opt === currentQuestion.options[getCorrectIndex(currentQuestion)]) {
            return {
                backgroundColor: correctBg,
                borderColor: correctBorder,
                borderWidth: 1,
            };
        }
        if (answers[currentQuestionIndex] === opt && opt !== currentQuestion.options[getCorrectIndex(currentQuestion)]) {
            return {
                backgroundColor: wrongBg,
                borderColor: wrongBorder,
                borderWidth: 1,
            };
        }
        return { backgroundColor: optionBg, borderColor, borderWidth: 1 };
    };

    const getOptionTextStyle = (opt: string) => {
        if (!showFeedback) {
            return answers[currentQuestionIndex] === opt
                ? { color: '#fff' }
                : { color: optionText };
        }
        if (opt === currentQuestion.options[getCorrectIndex(currentQuestion)]) {
            return { color: correctText, fontWeight: '700' as const };
        }
        if (answers[currentQuestionIndex] === opt && opt !== currentQuestion.options[getCorrectIndex(currentQuestion)]) {
            return { color: wrongText, fontWeight: '700' as const };
        }
        return { color: optionText };
    };

    if (showResults) {
        const percentage = (score / quiz.quiz.length) * 100;
        let resultEmoji, resultMessage, resultColor, shouldRetry, resultSubText;

        if (percentage >= 90) {
            resultEmoji = '🎉';
            resultMessage = 'Amazing! You and Dimpo are totally in sync with the story!';
            resultSubText = 'You caught every detail — like a true story explorer!';
            resultColor = '#10B981'; // Emerald
            shouldRetry = false;
        } else if (percentage >= 75) {
            resultEmoji = '🌟';
            resultMessage = "Great work! You're catching all the key moments!";
            resultSubText = "Dimpo's impressed. You're really following the journey!";
            resultColor = '#3B82F6'; // Blue
            shouldRetry = false;
        } else if (percentage >= 60) {
            resultEmoji = '👍';
            resultMessage = "Nice try! You're getting the hang of it — keep going!";
            resultSubText = "Some twists might've slipped by — read closely next time!";
            resultColor = '#F59E0B'; // Amber
            shouldRetry = true;
        } else {
            resultEmoji = '📖';
            resultMessage = "Let's dive back into the story together. Dimpo believes in you!";
            resultSubText = "Sometimes it takes a second read — every hero learns with time!";
            resultColor = '#EF4444'; // Red
            shouldRetry = true;
        }

        return (
            <View style={[styles.resultsContainer, { backgroundColor: cardBg }, shadow]}>
                <LinearGradient
                    colors={gradientColors}
                    style={styles.gradientBackground}
                />
                <Image
                    source={require('../../../assets/images/dimpo/reading.png')}
                    style={{ width: 160, height: 240, marginBottom: 8 }}
                    resizeMode="contain"
                    accessibilityLabel="Dimpo reading a book"
                />
                <Text style={[styles.quizTitle, { color: colors.primary, marginBottom: 4, fontSize: 22 }]}>
                    {resultMessage}
                </Text>
                <Text style={[styles.resultMessage, { color: colors.textSecondary, marginBottom: 12, fontSize: 15 }]}>
                    {resultSubText}
                </Text>
                
                {/* Show money earned message if applicable */}
                {hasEarnedMoney && percentage >= 80 && (
                    <View style={{ 
                        backgroundColor: isDark ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.1)', 
                        padding: 12, 
                        borderRadius: 8, 
                        marginBottom: 12,
                        borderWidth: 1,
                        borderColor: isDark ? 'rgba(34,197,94,0.3)' : 'rgba(34,197,94,0.3)'
                    }}>
                        <Text style={{ 
                            color: isDark ? '#4ADE80' : '#16A34A', 
                            fontSize: 14, 
                            fontWeight: '600', 
                            textAlign: 'center' 
                        }}>
                            💰 You earned $5! You can add it to your savings jars later.
                        </Text>
                    </View>
                )}
                
                <View style={{ width: '100%', height: 1, backgroundColor: isDark ? '#23242A' : '#E0E7FF', marginVertical: 12 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 8, gap: 24 }}>
                    <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 15, color: colors.textSecondary }}>Comprehension</Text>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: resultColor }}>
                            <Ionicons name="book-outline" size={18} color={resultColor} /> {percentage.toFixed(0)}%
                        </Text>
                    </View>
                </View>
                <Pressable
                    style={[styles.quizButton, { backgroundColor: colors.primary }]}
                    onPress={() => {
                        if (shouldRetry) {
                            // Reset quiz state
                            setCurrentQuestionIndex(0);
                            setAnswers({});
                            setShowResults(false);
                            setScore(0);
                            setShowFeedback(false);
                            setHasEarnedMoney(false);
                            // Close quiz and return to reading
                            onClose?.(true);
                        } else {
                            // Just close the quiz for good scores
                            onClose?.(false);
                        }
                    }}
                    disabled={isCompleting}
                >
                    {isCompleting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.quizButtonText}>
                            {shouldRetry ? 'Try Again' : 'Done'}
                        </Text>
                    )}
                </Pressable>
            </View>
        );
    }

    // Jar Selection Modal
    if (showJarSelection) {
        const percentage = (score / quiz.quiz.length) * 100;
        
        return (
            <Modal visible={showJarSelection} transparent animationType="fade">
                <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.35)' }]}>
                    <View style={[styles.modalContent, { backgroundColor: cardBg, borderRadius: 28, padding: 28, width: '92%', maxWidth: 420 }]}>
                        <LinearGradient
                            colors={gradientColors}
                            style={[styles.gradientBackground, { borderRadius: 20 }]}
                        />
                        
                        {/* Success Message */}
                        <View style={{ alignItems: 'center', marginBottom: 24 }}>
                            <Text style={{ fontSize: 64, marginBottom: 16 }}>💰</Text>
                            <Text style={[styles.quizTitle, { color: colors.primary, marginBottom: 8, fontSize: 24, textAlign: 'center' }]}>
                                Congratulations! You earned $5!
                            </Text>
                            <Text style={[styles.resultMessage, { color: colors.textSecondary, marginBottom: 16, fontSize: 16, textAlign: 'center' }]}>
                                You scored {percentage.toFixed(0)}% on the quiz! Choose a savings jar to add your reward.
                            </Text>
                        </View>

                        {/* Jar Selection */}
                        <View style={[styles.jarList, { marginBottom: 24 }]}>
                            <Text style={[styles.questionText, { color: colors.text, marginBottom: 16, fontSize: 18, textAlign: 'center' }]}>
                                Select a savings jar:
                            </Text>
                            
                            {savingsJugs.length === 0 ? (
                                <View style={{ alignItems: 'center', padding: 20 }}>
                                    <ActivityIndicator size="large" color={colors.primary} />
                                    <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Loading savings jars...</Text>
                                </View>
                            ) : (
                                <ScrollView style={{ maxHeight: 200 }}>
                                    {savingsJugs.map((jug) => (
                                        <Pressable
                                            key={jug.id}
                                            style={[
                                                styles.jarButton,
                                                {
                                                    backgroundColor: selectedJugId === jug.id ? '#ede9fe' : '#F3F4F6',
                                                    borderColor: selectedJugId === jug.id ? '#7C3AED' : '#E5E7EB',
                                                    borderWidth: 2,
                                                    marginBottom: 10,
                                                }
                                            ]}
                                            onPress={() => setSelectedJugId(jug.id)}
                                        >
                                            <Text style={[
                                                styles.jarButtonText,
                                                { color: selectedJugId === jug.id ? '#7C3AED' : '#374151' }
                                            ]}>
                                                {jug.name} - ${jug.balance.toFixed(2)}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </ScrollView>
                            )}
                        </View>

                        {/* Action Buttons */}
                        <View style={[styles.modalButtonRow, { width: '100%', marginTop: 8 }]}>
                            <Pressable
                                style={[
                                    styles.modalButton,
                                    { 
                                        backgroundColor: '#E5E7EB',
                                        flex: 1
                                    }
                                ]}
                                onPress={() => {
                                    setShowJarSelection(false);
                                    setSelectedJugId(null);
                                    setShowResults(true);
                                }}
                            >
                                <Text style={[styles.modalButtonText, { color: colors.text }]}>
                                    Skip
                                </Text>
                            </Pressable>
                            
                            <Pressable
                                style={[
                                    styles.modalButton,
                                    { 
                                        backgroundColor: selectedJugId ? '#7C3AED' : '#9CA3AF',
                                        flex: 1
                                    }
                                ]}
                                onPress={handleAddMoneyToJug}
                                disabled={!selectedJugId || isAddingMoney}
                            >
                                {isAddingMoney ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={[styles.modalButtonText, { color: colors.text }]}>
                                        Add $5
                                    </Text>
                                )}
                            </Pressable>
                        </View>
                        {showConfetti && (
                            <ConfettiCannon
                                count={90}
                                origin={{ x: 200, y: 0 }}
                                fadeOut
                                explosionSpeed={350}
                                fallSpeed={3000}
                            />
                        )}
                    </View>
                </View>
            </Modal>
        );
    }

    return (
        <View style={[styles.quizContainer, { backgroundColor: cardBg, marginTop: 0, borderRadius: 10, padding: 0, width: '95%' }, shadow]}>
            <LinearGradient
                colors={gradientColors}
                style={styles.gradientBackground}
            />
            <Pressable
                style={styles.closeButton}
                onPress={() => onClose?.(false)}
                accessibilityRole="button"
                accessibilityLabel="Close quiz"
            >
                <Ionicons
                    name="close"
                    size={24}
                    color={isDark ? '#E5E7EB' : '#374151'}
                />
            </Pressable>
            <View style={[styles.progressContainer, { backgroundColor: progressBg }]}>
                <View style={[styles.progressBar, { width: `${progress}%`, backgroundColor: progressBar }]} />
            </View>
            <Text style={[styles.quizTitle, { color: progressBar }]}>{quiz.chapterName}</Text>
            <Text style={[styles.progressText, { color: isDark ? '#A1A1AA' : '#6B7280' }]}>
                Question {currentQuestionIndex + 1} of {quiz.quiz.length}
            </Text>
            <View style={styles.questionBlock}>
                <Text style={[styles.questionText, { color: isDark ? '#F3F4F6' : colors.text }]}>{currentQuestion.question}</Text>
                {currentQuestion.options.map((opt, index) => (
                    <Pressable
                        key={opt}
                        style={[
                            styles.optionButton,
                            getOptionStyle(opt),
                        ]}
                        onPress={() => !showFeedback && handleSelect(currentQuestionIndex, opt)}
                        disabled={showFeedback}
                        accessibilityRole="button"
                    >
                        <Text style={[styles.optionText, getOptionTextStyle(opt)]}>{opt}</Text>
                    </Pressable>
                ))}
            </View>
            <View style={styles.feedbackContainer}>
                {showFeedback && (
                    <>
                        <View style={[
                            styles.feedbackBadge,
                            { backgroundColor: feedbackBadgeBg(isCorrect) }
                        ]}>
                            <Text style={[
                                styles.feedbackText,
                                { color: feedbackBadgeText(isCorrect) }
                            ]}>
                                {isCorrect ? 'Correct!' : 'Incorrect!'}
                            </Text>
                        </View>
                        {/* Show correct answer if user was wrong */}
                        {!isCorrect && (
                            <Text style={{ color: correctText, fontWeight: '600', marginBottom: 12 }}>
                                Correct answer: {currentQuestion.options[getCorrectIndex(currentQuestion)]}
                            </Text>
                        )}
                    </>
                )}
                <Pressable
                    style={[
                        styles.nextButton,
                        !answers[currentQuestionIndex] && styles.disabledButton
                    ]}
                    onPress={handleNext}
                    disabled={!answers[currentQuestionIndex]}
                >
                    <LinearGradient
                        colors={answers[currentQuestionIndex] ? nextButtonGradient : ['#9CA3AF', '#9CA3AF']}
                        style={styles.nextButtonGradient}
                    >
                        <Text style={[
                            styles.nextButtonText,
                            !answers[currentQuestionIndex] && styles.disabledButtonText
                        ]}>
                            {currentQuestionIndex < quiz.quiz.length - 1 ? 'Next Question' : 'See Results'}
                        </Text>
                    </LinearGradient>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    quizContainer: {
        width: '90%',
        minWidth: 320,
        maxWidth: 420,
        alignSelf: 'center',
        borderRadius: 28,
        backgroundColor: '#fff', // fallback, will be overridden by cardBg
        paddingHorizontal: 24,
        paddingVertical: 28,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.16,
        shadowRadius: 24,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        overflow: 'hidden',
        marginVertical: 24,
    },
    lightShadow: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    gradientBackground: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
    },
    progressContainer: {
        height: 6,
        borderRadius: 3,
        marginBottom: 20,
        overflow: 'hidden',
        marginTop: 32,
    },
    progressBar: {
        height: '100%',
        borderRadius: 3,
    },
    quizTitle: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 8,
        textAlign: 'center',
    },
    progressText: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 24,
        fontWeight: '500',
    },
    questionBlock: {
        marginBottom: 24,
    },
    questionText: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 20,
        lineHeight: 26,
    },
    optionButton: {
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 20,
        marginBottom: 12,
    },
    optionText: {
        fontSize: 16,
        fontWeight: '500',
    },
    feedbackContainer: {
        alignItems: 'center',
        marginTop: 24,
    },
    feedbackBadge: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        marginBottom: 20,
    },
    feedbackText: {
        fontSize: 16,
        fontWeight: '600',
    },
    nextButton: {
        width: '100%',
        borderRadius: 16,
        overflow: 'hidden',
    },
    nextButtonGradient: {
        paddingVertical: 14,
        alignItems: 'center',
    },
    nextButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    error: {
        marginTop: 24,
        fontSize: 16,
        textAlign: 'center',
        color: '#DC2626',
    },
    resultsContainer: {
        alignItems: 'center',
        width: '90%',
        minWidth: 320,
        maxWidth: 420,
        alignSelf: 'center',
        borderRadius: 28,
        backgroundColor: '#fff', // fallback, will be overridden by cardBg
        paddingHorizontal: 24,
        paddingVertical: 28,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.16,
        shadowRadius: 24,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        overflow: 'hidden',
        marginTop: 0,
        marginVertical: 24,
    },
    resultEmoji: {
        fontSize: 64,
        marginBottom: 16,
    },
    scoreContainer: {
        alignItems: 'center',
        marginVertical: 24,
    },
    scoreText: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    percentageText: {
        fontSize: 24,
        fontWeight: '600',
    },
    resultMessage: {
        fontSize: 18,
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 26,
    },
    quizButton: {
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 8,
        minWidth: 200,
    },
    quizButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    disabledButton: {
        opacity: 0.7,
    },
    disabledButtonText: {
        color: '#E5E7EB',
    },
    retryMessage: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
        fontStyle: 'italic',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 10,
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.35)', // slightly darker overlay
    },
    modalContent: {
        width: '92%',
        maxWidth: 420,
        padding: 28,
        borderRadius: 28,
        backgroundColor: '#fff',
        elevation: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 32,
        alignItems: 'center',
    },
    jarList: {
        width: '100%',
        marginBottom: 24,
    },
    jarButton: {
        borderRadius: 14,
        paddingVertical: 16,
        paddingHorizontal: 20,
        marginBottom: 10,
        borderWidth: 2,
        backgroundColor: '#F3F4F6',
        borderColor: '#E5E7EB',
        width: '100%',
        alignItems: 'flex-start',
    },
    jarButtonSelected: {
        backgroundColor: '#ede9fe', // light purple
        borderColor: '#7C3AED',
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
    },
    jarButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
    },
    jarButtonTextSelected: {
        color: '#7C3AED',
        fontWeight: '700',
    },
    modalButtonRow: {
        flexDirection: 'row',
        gap: 14,
        width: '100%',
        marginTop: 8,
    },
    modalButton: {
        flex: 1,
        borderRadius: 14,
        paddingVertical: 15,
        alignItems: 'center',
        backgroundColor: '#E5E7EB',
    },
    modalButtonPrimary: {
        backgroundColor: '#7C3AED',
    },
    modalButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
    },
    modalButtonTextPrimary: {
        color: '#fff',
    },
}); 