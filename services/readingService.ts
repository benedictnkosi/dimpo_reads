import { 
  getCurrentReading, 
  startReadingBook, 
  updateReadingProgress, 
  getRandomBook,
  finishReadingBook,
  getBookById,
  isChapterCompleted,
  getNextChapter
} from './database';

// Interface for current reading status
export interface CurrentReading {
  id: number;
  book_id: string;
  chapter_number: number;
  chapter_name: string;
  reading_date: string;
  created: string;
}

// Interface for book data
export interface Book {
  id: number;
  book_id: string;
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

// Get current reading status
export const getCurrentReadingStatus = async (): Promise<CurrentReading | null> => {
  try {
    const currentReading = await getCurrentReading();
    return currentReading;
  } catch (error) {
    console.error('[ReadingService] Error getting current reading status:', error);
    throw error;
  }
};

// Start reading a random book
export const startRandomReading = async (): Promise<Book> => {
  try {
    console.log('[ReadingService] Starting random reading...');
    
    // Get a random book
    const randomBook = await getRandomBook();
    
    if (!randomBook) {
      throw new Error('No books available in the database');
    }
    
    // Start reading the book
    await startReadingBook({
      book_id: randomBook.book_id,
      chapter_number: randomBook.chapter_number,
      chapter_name: randomBook.chapter_name
    });
    
    console.log(`[ReadingService] Started reading book: ${randomBook.chapter_name}`);
    return randomBook;
  } catch (error) {
    console.error('[ReadingService] Error starting random reading:', error);
    throw error;
  }
};

// Continue reading current book
export const continueReading = async (): Promise<CurrentReading | null> => {
  try {
    const currentReading = await getCurrentReading();
    
    if (!currentReading) {
      throw new Error('No active reading session found');
    }
    
    return currentReading;
  } catch (error) {
    console.error('[ReadingService] Error continuing reading:', error);
    throw error;
  }
};

// Update reading progress
export const updateReading = async (bookData: {
  book_id: string;
  chapter_number: number;
  chapter_name: string;
}): Promise<void> => {
  try {
    await updateReadingProgress(bookData);
    console.log(`[ReadingService] Updated reading progress for chapter: ${bookData.chapter_name}`);
  } catch (error) {
    console.error('[ReadingService] Error updating reading progress:', error);
    throw error;
  }
};

// Finish reading current book
export const finishCurrentReading = async (): Promise<void> => {
  try {
    await finishReadingBook();
    console.log('[ReadingService] Finished reading current book');
  } catch (error) {
    console.error('[ReadingService] Error finishing reading:', error);
    throw error;
  }
};

// Check if user is currently reading
export const isCurrentlyReading = async (): Promise<boolean> => {
  try {
    const currentReading = await getCurrentReading();
    return currentReading !== null;
  } catch (error) {
    console.error('[ReadingService] Error checking reading status:', error);
    return false;
  }
};

// Get book details for current reading
export const getCurrentBookDetails = async (): Promise<Book | null> => {
  try {
    const currentReading = await getCurrentReading();
    
    if (!currentReading) {
      return null;
    }
    
    const bookDetails = await getBookById(currentReading.book_id);
    
    return bookDetails;
  } catch (error) {
    console.error('[ReadingService] Error getting current book details:', error);
    return null;
  }
};

// Check if current chapter is completed
export const isCurrentChapterCompleted = async (): Promise<boolean> => {
  try {
    const currentReading = await getCurrentReading();
    
    if (!currentReading) {
      return false;
    }
    
    const bookDetails = await getBookById(currentReading.book_id);
    
    if (!bookDetails) {
      return false;
    }
    
    return await isChapterCompleted(bookDetails.id);
  } catch (error) {
    console.error('[ReadingService] Error checking if current chapter is completed:', error);
    return false;
  }
};

// Get next chapter for current book
export const getNextChapterForCurrentBook = async (): Promise<Book | null> => {
  try {
    const currentReading = await getCurrentReading();
    
    if (!currentReading) {
      return null;
    }
    
    const nextChapter = await getNextChapter(currentReading.book_id, currentReading.chapter_number);
    
    return nextChapter;
  } catch (error) {
    console.error('[ReadingService] Error getting next chapter:', error);
    return null;
  }
};

// Get smart book details (handles completed chapters and next chapters)
export const getSmartBookDetails = async (): Promise<{
  book: Book | null;
  isCompleted: boolean;
  hasNextChapter: boolean;
  nextChapter: Book | null;
} | null> => {
  try {
    const currentReading = await getCurrentReading();
    
    if (!currentReading) {
      return null;
    }
    
    const currentBook = await getBookById(currentReading.book_id);
    
    if (!currentBook) {
      return null;
    }
    
    const isCompleted = await isChapterCompleted(currentBook.id);
    const nextChapter = await getNextChapter(currentReading.book_id, currentReading.chapter_number);
    
    return {
      book: currentBook,
      isCompleted,
      hasNextChapter: nextChapter !== null,
      nextChapter
    };
  } catch (error) {
    console.error('[ReadingService] Error getting smart book details:', error);
    return null;
  }
}; 