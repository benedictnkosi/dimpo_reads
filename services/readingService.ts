import { 
  getCurrentReading, 
  startReadingBook, 
  updateReadingProgress, 
  getRandomBook,
  getRandomUncompletedBook,
  getRandomBookByReadingLevel,
  getRandomUncompletedBookByReadingLevel,
  finishReadingBook,
  getBookById,
  isChapterCompleted,
  hasUserCompletedChapterWithScore,
  getNextChapter,
  getNextChapterByReadingLevel,
  getCurrentReadingLevel,
  getBooksByReadingLevel,
  getBookByBookIdAndChapterNumber
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
  title?: string | null;
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
    
    // Get user's current reading level
    const userReadingLevel = await getCurrentReadingLevel();
    console.log(`[ReadingService] User reading level: ${userReadingLevel}`);
    
    // Try to get a random book at user's reading level
    let selectedBook = await getRandomBookByReadingLevel(userReadingLevel);
    
    if (!selectedBook) {
      console.log(`[ReadingService] No books found for reading level: ${userReadingLevel}, falling back to any book`);
      // Fallback to any book if no books found for user's level
      selectedBook = await getRandomBook();
      if (!selectedBook) {
        throw new Error('No books available in the database');
      }
      console.log(`[ReadingService] Started reading fallback book: ${selectedBook.chapter_name}`);
    } else {
      console.log(`[ReadingService] Found book at level ${userReadingLevel}: ${selectedBook.chapter_name}`);
    }
    
    // Start reading the book
    await startReadingBook({
      book_id: selectedBook.book_id,
      chapter_number: selectedBook.chapter_number,
      chapter_name: selectedBook.chapter_name
    });
    
    console.log(`[ReadingService] Started reading book: ${selectedBook.chapter_name}`);
    return selectedBook;
  } catch (error) {
    console.error('[ReadingService] Error starting random reading:', error);
    throw error;
  }
};

// Start reading a random uncompleted book
export const startRandomUncompletedReading = async (learnerUid: string): Promise<Book> => {
  try {
    console.log('[ReadingService] Starting random uncompleted reading...');
    
    // Get user's current reading level
    const userReadingLevel = await getCurrentReadingLevel();
    console.log(`[ReadingService] User reading level: ${userReadingLevel}`);
    
    // Try to get a random uncompleted book at user's reading level
    let selectedBook = await getRandomUncompletedBookByReadingLevel(learnerUid, userReadingLevel);
    
    if (!selectedBook) {
      console.log(`[ReadingService] No uncompleted books found for reading level: ${userReadingLevel}, falling back to any uncompleted book`);
      // Fallback to any uncompleted book if no books found for user's level
      selectedBook = await getRandomUncompletedBook(learnerUid);
      if (!selectedBook) {
        throw new Error('No uncompleted books available for this user');
      }
      console.log(`[ReadingService] Started reading fallback uncompleted book: ${selectedBook.chapter_name}`);
    } else {
      console.log(`[ReadingService] Found uncompleted book at level ${userReadingLevel}: ${selectedBook.chapter_name}`);
    }
    
    // Start reading the book
    await startReadingBook({
      book_id: selectedBook.book_id,
      chapter_number: selectedBook.chapter_number,
      chapter_name: selectedBook.chapter_name
    });
    
    console.log(`[ReadingService] Started reading uncompleted book: ${selectedBook.chapter_name}`);
    return selectedBook;
  } catch (error) {
    console.error('[ReadingService] Error starting random uncompleted reading:', error);
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
export const isCurrentChapterCompleted = async (learnerUid?: string): Promise<boolean> => {
  try {
    const currentReading = await getCurrentReading();
    
    if (!currentReading) {
      return false;
    }
    
    const bookDetails = await getBookById(currentReading.book_id);
    
    if (!bookDetails) {
      return false;
    }
    
    // Check if the current user has completed this chapter with a score of 80+
    if (learnerUid) {
      return await hasUserCompletedChapterWithScore(learnerUid, bookDetails.id, 80);
    } else {
      // Fallback to checking if any user has completed the chapter
      return await isChapterCompleted(bookDetails.id);
    }
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
export const getSmartBookDetails = async (learnerUid?: string): Promise<{
  book: Book | null;
  isCompleted: boolean;
  hasNextChapter: boolean;
  nextChapter: Book | null;
} | null> => {
  try {
    const currentReading = await getCurrentReading();
    
    if (!currentReading) {
      console.log('[getSmartBookDetails] No current reading found');
      return null;
    }
    
    console.log(`[getSmartBookDetails] Current reading: book_id=${currentReading.book_id}, chapter_number=${currentReading.chapter_number}`);
    
    // Get the current book with the specific chapter number
    const currentBook = await getBookByBookIdAndChapterNumber(currentReading.book_id, currentReading.chapter_number);
    
    if (!currentBook) {
      console.log(`[getSmartBookDetails] No book found for book_id: ${currentReading.book_id}, chapter_number: ${currentReading.chapter_number}`);
      return null;
    }
    
    console.log(`[getSmartBookDetails] Current book: ${currentBook.chapter_name} (${currentBook.reading_level})`);
    
    // Check if the current user has completed this chapter with a score of 80+
    let isCompleted = false;
    if (learnerUid) {
      isCompleted = await hasUserCompletedChapterWithScore(learnerUid, currentBook.id, 80);
    } else {
      // Fallback to checking if any user has completed the chapter
      isCompleted = await isChapterCompleted(currentBook.id);
    }
    
    console.log(`[getSmartBookDetails] Chapter completed: ${isCompleted}`);
    
    // Get user's reading level to filter next chapter
    const userReadingLevel = await getCurrentReadingLevel();
    console.log(`[getSmartBookDetails] User reading level: ${userReadingLevel}`);
    
    // Try to get next chapter at user's reading level first
    let nextChapter = await getNextChapterByReadingLevel(currentReading.book_id, currentReading.chapter_number, userReadingLevel);
    
    if (!nextChapter) {
      console.log(`[getSmartBookDetails] No next chapter found at user's reading level (${userReadingLevel}), falling back to any next chapter`);
      // Fallback to any next chapter if no chapter found at user's level
      nextChapter = await getNextChapter(currentReading.book_id, currentReading.chapter_number);
      if (nextChapter) {
        console.log(`[getSmartBookDetails] Fallback next chapter: ${nextChapter.chapter_name} (${nextChapter.reading_level})`);
      } else {
        console.log(`[getSmartBookDetails] No fallback next chapter found`);
      }
    } else {
      console.log(`[getSmartBookDetails] Found next chapter at user's reading level: ${nextChapter.chapter_name} (${nextChapter.reading_level})`);
    }
    
    const result = {
      book: currentBook,
      isCompleted,
      hasNextChapter: nextChapter !== null,
      nextChapter
    };
    
    console.log(`[getSmartBookDetails] Final result:`, {
      isCompleted: result.isCompleted,
      hasNextChapter: result.hasNextChapter,
      nextChapterName: result.nextChapter?.chapter_name,
      nextChapterNumber: result.nextChapter?.chapter_number,
      nextChapterLevel: result.nextChapter?.reading_level
    });
    
    return result;
  } catch (error) {
    console.error('[ReadingService] Error getting smart book details:', error);
    return null;
  }
}; 