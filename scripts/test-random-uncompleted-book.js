const { initDatabase, getRandomUncompletedBook, getAllBooks, getUserCompletedChaptersWithScore } = require('../services/database');

async function testRandomUncompletedBook() {
  try {
    console.log('Initializing database...');
    await initDatabase();
    
    // Test with a sample user UID
    const testUserUid = 'test-user-123';
    
    console.log('\n=== Testing getRandomUncompletedBook ===');
    
    // Get all books first
    const allBooks = await getAllBooks();
    console.log(`Total books in database: ${allBooks.length}`);
    
    // Get completed chapters for the test user
    const completedChapters = await getUserCompletedChaptersWithScore(testUserUid, 80);
    console.log(`Completed chapters for user ${testUserUid}: ${completedChapters.length}`);
    
    if (completedChapters.length > 0) {
      console.log('Completed chapters:');
      completedChapters.forEach((chapter, index) => {
        console.log(`${index + 1}. ${chapter.chapter_name} (Score: ${chapter.score}%)`);
      });
    }
    
    // Test getting random uncompleted book
    console.log('\nGetting random uncompleted book...');
    const randomUncompletedBook = await getRandomUncompletedBook(testUserUid);
    
    if (randomUncompletedBook) {
      console.log('✅ Random uncompleted book found:');
      console.log(`- Book ID: ${randomUncompletedBook.book_id}`);
      console.log(`- Chapter: ${randomUncompletedBook.chapter_number} - ${randomUncompletedBook.chapter_name}`);
      console.log(`- Genre: ${randomUncompletedBook.genre}/${randomUncompletedBook.sub_genre}`);
      console.log(`- Reading Level: ${randomUncompletedBook.reading_level}`);
      
      // Verify this book is not in completed chapters
      const isCompleted = completedChapters.some(chapter => chapter.chapter_id === randomUncompletedBook.id);
      console.log(`- Is completed: ${isCompleted ? '❌ ERROR: Book is completed!' : '✅ Correct: Book is not completed'}`);
    } else {
      console.log('❌ No uncompleted books found');
    }
    
    // Test multiple calls to ensure randomness
    console.log('\n=== Testing randomness (5 calls) ===');
    const results = [];
    for (let i = 0; i < 5; i++) {
      const book = await getRandomUncompletedBook(testUserUid);
      if (book) {
        results.push(`${book.chapter_name} (${book.book_id})`);
      }
    }
    
    console.log('Random books selected:');
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result}`);
    });
    
    // Check for duplicates
    const uniqueResults = [...new Set(results)];
    console.log(`\nUnique results: ${uniqueResults.length}/${results.length}`);
    if (uniqueResults.length < results.length) {
      console.log('⚠️  Some duplicates found (this is normal with small datasets)');
    } else {
      console.log('✅ All results are unique');
    }
    
  } catch (error) {
    console.error('Error testing random uncompleted book:', error);
  }
}

// Run the test
testRandomUncompletedBook(); 