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
    console.log(`📚 Total chapters loaded: ${allBooks.length}\n`);

    // Get statistics
    console.log('6. Getting book statistics...');
    const stats = await getBookStatistics();
    console.log('📊 Book Statistics:');
    console.log(`   Total unique books: ${stats.total_books}`);
    console.log(`   Total chapters: ${stats.total_chapters}`);
    console.log(`   Total genres: ${stats.genres_count}`);
    console.log(`   Total reading levels: ${stats.reading_levels_count}`);
    console.log(`   Average word count: ${stats.average_word_count}`);
    console.log(`   Total word count: ${stats.total_word_count}\n`);

    // Display sample books grouped by book_id
    console.log('7. Sample books grouped by book_id:');
    const booksByBookId = {};
    allBooks.forEach(book => {
      if (!booksByBookId[book.book_id]) {
        booksByBookId[book.book_id] = [];
      }
      booksByBookId[book.book_id].push(book);
    });

    Object.keys(booksByBookId).slice(0, 5).forEach(bookId => {
      const chapters = booksByBookId[bookId];
      console.log(`\n📖 Book ID: ${bookId}`);
      console.log(`   Genre: ${chapters[0].genre}/${chapters[0].sub_genre}`);
      console.log(`   Reading Level: ${chapters[0].reading_level}`);
      console.log(`   Chapters: ${chapters.length}`);
      chapters.forEach(chapter => {
        console.log(`     Chapter ${chapter.chapter_number}: ${chapter.chapter_name}`);
      });
    });

    // Check for books with multiple chapters
    const booksWithMultipleChapters = Object.keys(booksByBookId).filter(bookId => 
      booksByBookId[bookId].length > 1
    );
    
    console.log(`\n🎯 Books with multiple chapters: ${booksWithMultipleChapters.length}`);
    if (booksWithMultipleChapters.length > 0) {
      console.log('✅ SUCCESS: Multiple chapters per book are now working!');
    } else {
      console.log('❌ ISSUE: No books with multiple chapters found');
    }

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testBookLoading(); 