import { initDatabase, insertBook, insertSavingsJug, insertSavingsTransaction } from './database';
import booksData from '@/assets/books.json';
import { initializeSavingsWithSampleData } from './savingsService';

// Sample savings jars data
const SAMPLE_SAVINGS_JUGS = [
  { name: 'Emergency Fund' },
  { name: 'Vacation Fund' },
  { name: 'New Car Fund' },
  { name: 'Home Renovation' },
  { name: 'Gift Fund' }
];

// Sample transactions data
const SAMPLE_TRANSACTIONS = [
  { jug_name: 'Emergency Fund', transaction_name: 'Monthly contribution', amount: 100 },
  { jug_name: 'Emergency Fund', transaction_name: 'Monthly contribution', amount: 100 },
  { jug_name: 'Vacation Fund', transaction_name: 'Bonus deposit', amount: 500 },
  { jug_name: 'Gift Fund', transaction_name: 'Birthday money', amount: 75 }
];

// Initialize database and populate with sample data
export const initializeDatabase = async () => {
  try {
    console.log('Initializing database...');
    
    // Initialize the database
    initDatabase();
    
    // Load books into database
    await loadBooksIntoDatabase();
    
    // Load savings data into database
    await loadSavingsIntoDatabase();
    
    console.log('Database initialization completed successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

// Load books from JSON file into database
const loadBooksIntoDatabase = async () => {
  try {
    console.log('Loading books into database...');
    
    // Check if books already exist
    const existingBooks = await getAllBooks();
    if (existingBooks.length > 0) {
      console.log('Books already exist in database, skipping...');
      return;
    }
    
    // Insert books from JSON data
    for (const book of booksData.books) {
      await insertBook({
        book_id: book.book_id,
        genre: book.genre,
        sub_genre: book.sub_genre,
        chapter_number: book.chapter_number,
        chapter_name: book.chapter_name,
        content: book.content,
        quiz: book.quiz ? JSON.stringify(book.quiz) : undefined,
        images: book.images ? JSON.stringify(book.images) : undefined,
        word_count: book.word_count,
        reading_level: book.reading_level
      });
    }
    
    console.log(`Loaded ${booksData.books.length} books into database`);
  } catch (error) {
    console.error('Error loading books into database:', error);
    throw error;
  }
};

// Load savings data into database
const loadSavingsIntoDatabase = async () => {
  try {
    console.log('Loading savings data into database...');
    
    // Check if savings jars already exist
    const existingJugs = await getAllSavingsJugs();
    if (existingJugs.length > 0) {
      console.log('Savings data already exists in database, skipping...');
      return;
    }
    
    // Insert sample savings jars
    for (const jug of SAMPLE_SAVINGS_JUGS) {
      await insertSavingsJug({ name: jug.name });
    }
    
    // Get the inserted jugs to get their IDs
    const insertedJugs = await getAllSavingsJugs();
    
    // Insert sample transactions
    for (const transaction of SAMPLE_TRANSACTIONS) {
      const jug = insertedJugs.find(j => j.name === transaction.jug_name);
      if (jug) {
        await insertSavingsTransaction({
          savings_jug_id: jug.id,
          transaction_name: transaction.transaction_name,
          amount: transaction.amount
        });
      }
    }
    
    console.log(`Loaded ${SAMPLE_SAVINGS_JUGS.length} savings jars and ${SAMPLE_TRANSACTIONS.length} transactions into database`);
  } catch (error) {
    console.error('Error loading savings data into database:', error);
    throw error;
  }
};

// Import the missing functions from database.ts
import { getAllBooks, getAllSavingsJugs } from './database'; 