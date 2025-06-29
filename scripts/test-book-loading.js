const { initDatabase, getAllBooks, getBookStatistics, clearAllBooks } = require('../services/database');
const { loadBooksFromJSON, checkBooksLoaded } = require('../services/bookService');

async function testBookLoading() {
  try {
    console.log('🧪 Testing Book Loading Functionality...\n');

    // Initialize database
    console.log('1. Initializing database...');
    initDatabase();
    console.log('✅ Database initialized\n');

    // Check if books are already loaded
    console.log('2. Checking if books are already loaded...');
    const booksLoaded = await checkBooksLoaded();
    console.log(`📚 Books loaded: ${booksLoaded}\n`);

    if (booksLoaded) {
      console.log('3. Books already exist, clearing them first...');
      await clearAllBooks();
      console.log('✅ Books cleared\n');
    }

    // Load books from JSON
    console.log('4. Loading books from JSON...');
    await loadBooksFromJSON();
    console.log('✅ Books loaded from JSON\n');

    // Verify books were loaded
    console.log('5. Verifying books were loaded...');
    const allBooks = await getAllBooks();
    console.log(`📚 Total books loaded: ${allBooks.length}\n`);

    // Get statistics
    console.log('6. Getting book statistics...');
    const stats = await getBookStatistics();
    console.log('📊 Book Statistics:');
    console.log(`   Total books: ${stats.total_books}`);
    console.log(`   Total genres: ${stats.total_genres}`);
    console.log(`   Total reading levels: ${stats.total_reading_levels}`);
    console.log(`   Average word count: ${stats.average_word_count}`);
    console.log(`   Total word count: ${stats.total_word_count}\n`);

    // Display sample books
    console.log('7. Sample books loaded:');
    allBooks.slice(0, 3).forEach((book, index) => {
      console.log(`   ${index + 1}. ${book.chapter_name}`);
      console.log(`      Genre: ${book.genre} → ${book.sub_genre}`);
      console.log(`      Reading Level: ${book.reading_level}`);
      console.log(`      Word Count: ${book.word_count}`);
      console.log(`      Has Quiz: ${book.quiz ? 'Yes' : 'No'}`);
      console.log(`      Has Images: ${book.images ? 'Yes' : 'No'}\n`);
    });

    console.log('🎉 Book loading test completed successfully!');

  } catch (error) {
    console.error('❌ Error during book loading test:', error);
  }
}

// Run the test
testBookLoading(); 