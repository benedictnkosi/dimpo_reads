const { 
  initDatabase, 
  getRandomBookByReadingLevel, 
  getRandomUncompletedBookByReadingLevel,
  getCurrentReadingLevel,
  getAllBooks,
  getUserCompletedChaptersWithScore,
  getNextChapter,
  getNextChapterByReadingLevel,
  startReadingBook,
  getCurrentReading
} = require('../services/database');

async function testReadingLevelBookSelection() {
  try {
    console.log('Initializing database...');
    await initDatabase();
    
    // Test with a sample user UID
    const testUserUid = 'test-user-123';
    
    console.log('\n=== Testing Reading Level Book Selection ===');
    
    // Get all books first
    const allBooks = await getAllBooks();
    console.log(`Total books in database: ${allBooks.length}`);
    
    // Get books by reading level
    const readingLevels = ['Explorer', 'Builder', 'Challenger'];
    const booksByLevel = {};
    
    readingLevels.forEach(level => {
      const books = allBooks.filter(book => book.reading_level === level);
      booksByLevel[level] = books;
      console.log(`Books at ${level} level: ${books.length}`);
    });
    
    // Test getRandomBookByReadingLevel for each level
    console.log('\n=== Testing getRandomBookByReadingLevel ===');
    for (const level of readingLevels) {
      console.log(`\nTesting ${level} level:`);
      
      if (booksByLevel[level].length === 0) {
        console.log(`  ⚠️  No books found for ${level} level`);
        continue;
      }
      
      const randomBook = await getRandomBookByReadingLevel(level);
      if (randomBook) {
        console.log(`  ✅ Random book found: ${randomBook.chapter_name}`);
        console.log(`     - Reading Level: ${randomBook.reading_level}`);
        console.log(`     - Genre: ${randomBook.genre}/${randomBook.sub_genre}`);
        
        // Verify the book is at the correct reading level
        if (randomBook.reading_level === level) {
          console.log(`     ✅ Correct reading level`);
        } else {
          console.log(`     ❌ ERROR: Wrong reading level! Expected ${level}, got ${randomBook.reading_level}`);
        }
      } else {
        console.log(`  ❌ No book found for ${level} level`);
      }
    }
    
    // Test getRandomUncompletedBookByReadingLevel for each level
    console.log('\n=== Testing getRandomUncompletedBookByReadingLevel ===');
    
    // Get completed chapters for the test user
    const completedChapters = await getUserCompletedChaptersWithScore(testUserUid, 80);
    console.log(`Completed chapters for user ${testUserUid}: ${completedChapters.length}`);
    
    for (const level of readingLevels) {
      console.log(`\nTesting ${level} level (uncompleted):`);
      
      if (booksByLevel[level].length === 0) {
        console.log(`  ⚠️  No books found for ${level} level`);
        continue;
      }
      
      const randomUncompletedBook = await getRandomUncompletedBookByReadingLevel(testUserUid, level);
      if (randomUncompletedBook) {
        console.log(`  ✅ Random uncompleted book found: ${randomUncompletedBook.chapter_name}`);
        console.log(`     - Reading Level: ${randomUncompletedBook.reading_level}`);
        console.log(`     - Genre: ${randomUncompletedBook.genre}/${randomUncompletedBook.sub_genre}`);
        
        // Verify the book is at the correct reading level
        if (randomUncompletedBook.reading_level === level) {
          console.log(`     ✅ Correct reading level`);
        } else {
          console.log(`     ❌ ERROR: Wrong reading level! Expected ${level}, got ${randomUncompletedBook.reading_level}`);
        }
        
        // Verify this book is not in completed chapters
        const isCompleted = completedChapters.some(chapter => chapter.chapter_id === randomUncompletedBook.id);
        console.log(`     - Is completed: ${isCompleted ? '❌ ERROR: Book is completed!' : '✅ Correct: Book is not completed'}`);
      } else {
        console.log(`  ❌ No uncompleted book found for ${level} level`);
        
        // Check if all books at this level are completed
        const completedBooksAtLevel = completedChapters.filter(chapter => {
          const book = allBooks.find(b => b.id === chapter.chapter_id);
          return book && book.reading_level === level;
        });
        
        if (completedBooksAtLevel.length === booksByLevel[level].length) {
          console.log(`     ℹ️  All books at ${level} level are completed`);
        }
      }
    }
    
    // Test continue reading functionality with reading level filtering
    console.log('\n=== Testing Continue Reading with Reading Level Filtering ===');
    
    // Find a book with multiple chapters at different reading levels
    const booksWithMultipleChapters = {};
    allBooks.forEach(book => {
      if (!booksWithMultipleChapters[book.book_id]) {
        booksWithMultipleChapters[book.book_id] = [];
      }
      booksWithMultipleChapters[book.book_id].push(book);
    });
    
    // Find a book that has chapters at different reading levels
    let testBook = null;
    for (const [bookId, chapters] of Object.entries(booksWithMultipleChapters)) {
      if (chapters.length > 1) {
        const readingLevelsInBook = [...new Set(chapters.map(ch => ch.reading_level))];
        if (readingLevelsInBook.length > 1) {
          testBook = chapters[0]; // Use first chapter
          console.log(`Found test book: ${testBook.book_id} with chapters at levels: ${readingLevelsInBook.join(', ')}`);
          break;
        }
      }
    }
    
    if (testBook) {
      // Start reading the test book
      console.log(`\nStarting to read: ${testBook.chapter_name} (${testBook.reading_level})`);
      await startReadingBook({
        book_id: testBook.book_id,
        chapter_number: testBook.chapter_number,
        chapter_name: testBook.chapter_name
      });
      
      // Test getting next chapter without reading level filter
      console.log('\nTesting getNextChapter (no reading level filter):');
      const nextChapterAny = await getNextChapter(testBook.book_id, testBook.chapter_number);
      if (nextChapterAny) {
        console.log(`  ✅ Next chapter found: ${nextChapterAny.chapter_name} (${nextChapterAny.reading_level})`);
      } else {
        console.log(`  ❌ No next chapter found`);
      }
      
      // Test getting next chapter with reading level filter
      console.log('\nTesting getNextChapterByReadingLevel:');
      for (const level of readingLevels) {
        const nextChapterAtLevel = await getNextChapterByReadingLevel(testBook.book_id, testBook.chapter_number, level);
        if (nextChapterAtLevel) {
          console.log(`  ✅ Next chapter at ${level} level: ${nextChapterAtLevel.chapter_name} (${nextChapterAtLevel.reading_level})`);
          
          // Verify the reading level is correct
          if (nextChapterAtLevel.reading_level === level) {
            console.log(`     ✅ Correct reading level`);
          } else {
            console.log(`     ❌ ERROR: Wrong reading level! Expected ${level}, got ${nextChapterAtLevel.reading_level}`);
          }
        } else {
          console.log(`  ❌ No next chapter found at ${level} level`);
        }
      }
      
      // Clean up - finish reading
      console.log('\nCleaning up test reading session...');
      // Note: In a real test, you might want to use a proper cleanup function
    } else {
      console.log('⚠️  No suitable test book found with multiple chapters at different reading levels');
    }
    
    // Test randomness for a specific level
    console.log('\n=== Testing randomness for Explorer level (5 calls) ===');
    const explorerResults = [];
    for (let i = 0; i < 5; i++) {
      const book = await getRandomBookByReadingLevel('Explorer');
      if (book) {
        explorerResults.push(`${book.chapter_name} (${book.book_id})`);
      }
    }
    
    console.log('Random Explorer books selected:');
    explorerResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result}`);
    });
    
    // Check for duplicates
    const uniqueExplorerResults = [...new Set(explorerResults)];
    console.log(`\nUnique Explorer results: ${uniqueExplorerResults.length}/${explorerResults.length}`);
    if (uniqueExplorerResults.length < explorerResults.length) {
      console.log('⚠️  Some duplicates found (this is normal with small datasets)');
    } else {
      console.log('✅ All Explorer results are unique');
    }
    
    // Test current reading level
    console.log('\n=== Testing Current Reading Level ===');
    const currentLevel = await getCurrentReadingLevel();
    console.log(`Current reading level: ${currentLevel}`);
    
    // Test book selection with current level
    const currentLevelBook = await getRandomBookByReadingLevel(currentLevel);
    if (currentLevelBook) {
      console.log(`✅ Book found for current level (${currentLevel}): ${currentLevelBook.chapter_name}`);
    } else {
      console.log(`❌ No book found for current level (${currentLevel})`);
    }
    
  } catch (error) {
    console.error('Error testing reading level book selection:', error);
  }
}

// Run the test
testReadingLevelBookSelection(); 