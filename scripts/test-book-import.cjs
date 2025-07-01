const fs = require('fs');
const path = require('path');

// Read the books.json file
const booksPath = path.join(__dirname, '../assets/books.json');
const booksData = JSON.parse(fs.readFileSync(booksPath, 'utf8'));

console.log('=== TESTING BOOK IMPORT PROCESS ===');

// Simulate the bookService.loadBooksFromJSON process
const books = booksData.books;
console.log(`Found ${books.length} books in JSON file`);

let insertedCount = 0;
let skippedCount = 0;
let titleIssues = 0;

for (const book of books) {
  try {
    // Simulate the insertBook call from bookService.ts
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

    // Check if title is being passed correctly
    if (!bookData.title) {
      titleIssues++;
      console.log(`❌ Book ${book.book_id} (chapter ${book.chapter_number}) - title is falsy: "${bookData.title}"`);
      console.log(`   Original book.title: "${book.title}"`);
      console.log(`   Type: ${typeof book.title}`);
    }

    // Simulate the database insert (just log what would be inserted)
    console.log(`✅ Book ${book.book_id} (chapter ${book.chapter_number}) - title: "${bookData.title}"`);
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

// Check specific books that might have issues
console.log('\n=== CHECKING SPECIFIC BOOKS ===');
const specificBookId = 'school_life_300_11_14'; // This seems to be the one with null title in DB
const specificBooks = books.filter(book => book.book_id === specificBookId);

if (specificBooks.length > 0) {
  console.log(`\nBooks with book_id "${specificBookId}":`);
  specificBooks.forEach((book, index) => {
    console.log(`  ${index + 1}. Chapter ${book.chapter_number}:`);
    console.log(`     Title: "${book.title}"`);
    console.log(`     Type: ${typeof book.title}`);
    console.log(`     Chapter name: "${book.chapter_name}"`);
  });
} else {
  console.log(`\nNo books found with book_id "${specificBookId}"`);
}

// Check for any books with potentially problematic titles
console.log('\n=== CHECKING FOR PROBLEMATIC TITLES ===');
books.forEach((book, index) => {
  if (book.title === null || book.title === undefined || book.title === '') {
    console.log(`⚠️  Book ${index + 1} (${book.book_id}) has problematic title: "${book.title}"`);
  }
}); 