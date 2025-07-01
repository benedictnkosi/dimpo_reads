const fs = require('fs');
const path = require('path');

// Read the books.json file
const booksPath = path.join(__dirname, '../assets/books.json');
const booksData = JSON.parse(fs.readFileSync(booksPath, 'utf8'));

console.log('=== TESTING DATABASE IMPORT PROCESS ===');

// Simulate the exact process from bookService.ts
const books = booksData.books;
console.log(`Found ${books.length} books in JSON file`);

let insertedCount = 0;
let skippedCount = 0;
let titleIssues = 0;

for (const book of books) {
  try {
    // Simulate the exact insertBook call from bookService.ts
    const bookData = {
      book_id: book.book_id,
      title: book.title,
      genre: book.genre,
      sub_genre: book.sub_genre,
      chapter_number: book.chapter_number,
      chapter_name: book.chapter_name,
      content: book.content,
      quiz: JSON.stringify(book.quiz),
      images: JSON.stringify(book.images),
      word_count: book.word_count,
      reading_level: book.reading_level
    };

    // Simulate the database insert logic from database.ts
    const titleValue = bookData.title || null;
    
    // Check if title is being processed correctly
    if (titleValue === null && book.title) {
      titleIssues++;
      console.log(`❌ Book ${book.book_id} (chapter ${book.chapter_number}) - title became null!`);
      console.log(`   Original book.title: "${book.title}"`);
      console.log(`   bookData.title: "${bookData.title}"`);
      console.log(`   titleValue: "${titleValue}"`);
      console.log(`   Type of book.title: ${typeof book.title}`);
      console.log(`   Type of bookData.title: ${typeof bookData.title}`);
    }

    // Log successful imports
    if (book.book_id === 'school_life_300_11_14') {
      console.log(`🔍 DEBUG - Book ${book.book_id} (chapter ${book.chapter_number}):`);
      console.log(`   Original title: "${book.title}"`);
      console.log(`   Processed title: "${titleValue}"`);
      console.log(`   Would be inserted as: ${titleValue === null ? 'NULL' : `"${titleValue}"`}`);
    }

    insertedCount++;
    
  } catch (error) {
    console.error(`❌ Error processing book ${book.book_id}:`, error);
    skippedCount++;
  }
}

console.log('\n=== IMPORT SUMMARY ===');
console.log(`Successfully processed: ${insertedCount}`);
console.log(`Skipped: ${skippedCount}`);
console.log(`Title issues: ${titleIssues}`);

// Check for any books with empty strings that might become null
console.log('\n=== CHECKING FOR EMPTY STRING TITLES ===');
let emptyStringTitles = 0;
books.forEach((book, index) => {
  if (book.title === '') {
    emptyStringTitles++;
    console.log(`⚠️  Book ${index + 1} (${book.book_id}) has empty string title`);
  }
});

console.log(`Books with empty string titles: ${emptyStringTitles}`);

// Check for any books with whitespace-only titles
console.log('\n=== CHECKING FOR WHITESPACE-ONLY TITLES ===');
let whitespaceTitles = 0;
books.forEach((book, index) => {
  if (book.title && book.title.trim() === '') {
    whitespaceTitles++;
    console.log(`⚠️  Book ${index + 1} (${book.book_id}) has whitespace-only title: "${book.title}"`);
  }
});

console.log(`Books with whitespace-only titles: ${whitespaceTitles}`); 