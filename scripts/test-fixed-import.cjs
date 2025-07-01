const { initDatabase, getAllBooks, clearAllBooks } = require('../services/database');
const { initializeDatabase } = require('../services/databaseInit');

async function testFixedImport() {
  try {
    console.log('🧪 Testing Fixed Database Import...\n');

    // Initialize database
    console.log('1. Initializing database...');
    await initializeDatabase();
    console.log('✅ Database initialized\n');

    // Get all books
    console.log('2. Getting all books from database...');
    const allBooks = await getAllBooks();
    console.log(`📚 Total books loaded: ${allBooks.length}\n`);

    // Check for books with null titles
    console.log('3. Checking for books with null titles...');
    const booksWithNullTitles = allBooks.filter(book => book.title === null);
    const booksWithValidTitles = allBooks.filter(book => book.title !== null);
    
    console.log(`✅ Books with valid titles: ${booksWithValidTitles.length}`);
    console.log(`❌ Books with null titles: ${booksWithNullTitles.length}\n`);

    if (booksWithNullTitles.length > 0) {
      console.log('⚠️  Books with null titles:');
      booksWithNullTitles.slice(0, 5).forEach(book => {
        console.log(`   - ${book.book_id} (Chapter ${book.chapter_number}): "${book.chapter_name}"`);
      });
      if (booksWithNullTitles.length > 5) {
        console.log(`   ... and ${booksWithNullTitles.length - 5} more`);
      }
      console.log('');
    }

    // Show sample books with titles
    console.log('4. Sample books with titles:');
    booksWithValidTitles.slice(0, 5).forEach(book => {
      console.log(`   - "${book.title}" (${book.book_id}) - Chapter ${book.chapter_number}: "${book.chapter_name}"`);
    });
    console.log('');

    // Check specific book that was mentioned in the issue
    console.log('5. Checking specific book (school_life_300_11_14):');
    const specificBooks = allBooks.filter(book => book.book_id === 'school_life_300_11_14');
    if (specificBooks.length > 0) {
      specificBooks.forEach(book => {
        console.log(`   Chapter ${book.chapter_number}: "${book.title}"`);
      });
    } else {
      console.log('   No books found with that book_id');
    }
    console.log('');

    // Summary
    console.log('6. Summary:');
    if (booksWithNullTitles.length === 0) {
      console.log('✅ SUCCESS: All books have valid titles!');
    } else {
      console.log(`❌ ISSUE: ${booksWithNullTitles.length} books still have null titles`);
    }

  } catch (error) {
    console.error('❌ Error testing fixed import:', error);
  }
}

// Run the test
testFixedImport()
  .then(() => {
    console.log('\n🎉 Test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  }); 