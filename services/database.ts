import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

let db: SQLite.SQLiteDatabase | null = null;

// Initialize database
export const initDatabase = () => {
  if (db) return db;

  try {
    db = SQLite.openDatabaseSync('dimpo_reads.db');
    console.log('Database initialized successfully');
    createTables();
    return db;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

// Create tables
const createTables = () => {
  if (!db) return;

  try {
    // Migration: Add emoji column if it doesn't exist
    db.execSync(`ALTER TABLE savings_jug ADD COLUMN emoji TEXT`);
  } catch (e) {
    // Ignore error if column already exists
  }

  // Migration: Fix book table schema to allow multiple chapters per book
  try {
    // Check if the old unique constraint exists on book_id
    const tableInfo = db.getAllSync<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>("PRAGMA table_info(book)");
    const bookIdColumn = tableInfo.find(col => col.name === 'book_id');
    
    if (bookIdColumn) {
      // Check if there's a unique constraint by looking at the index
      const indexes = db.getAllSync<{
        name: string;
        type: string;
        tbl_name: string;
        sql: string;
      }>("PRAGMA index_list(book)");
      
      const hasUniqueBookIdIndex = indexes.some(index => 
        index.sql && index.sql.includes('UNIQUE') && index.sql.includes('book_id')
      );
      
      if (hasUniqueBookIdIndex) {
        // This means book_id has a unique constraint, we need to recreate the table
        console.log('Migrating book table schema to support multiple chapters per book...');
        
        // Create a temporary table with the new schema
        db.execSync(`
          CREATE TABLE book_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            book_id TEXT NOT NULL,
            title TEXT,
            genre TEXT NOT NULL,
            sub_genre TEXT NOT NULL,
            chapter_number INTEGER NOT NULL,
            chapter_name TEXT NOT NULL,
            content TEXT NOT NULL,
            quiz TEXT,
            images TEXT,
            word_count INTEGER NOT NULL DEFAULT 0,
            reading_level TEXT NOT NULL,
            created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(book_id, chapter_number)
          );
        `);
        
        // Copy data from old table to new table
        db.execSync(`
          INSERT INTO book_new (id, book_id, genre, sub_genre, chapter_number, chapter_name, content, quiz, images, word_count, reading_level, created, updated)
          SELECT id, book_id, genre, sub_genre, chapter_number, chapter_name, content, quiz, images, word_count, reading_level, created, updated
          FROM book;
        `);
        
        // Drop old table and rename new table
        db.execSync('DROP TABLE book');
        db.execSync('ALTER TABLE book_new RENAME TO book');
        
        console.log('Book table migration completed successfully');
      }
    }
  } catch (e) {
    console.log('Book table migration not needed or failed:', e);
  }

  try {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS question_report (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_id TEXT NOT NULL,
        outcome TEXT NOT NULL CHECK (outcome IN ('correct', 'incorrect')),
        date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    db.execSync(`
      CREATE TABLE IF NOT EXISTS book (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id TEXT NOT NULL,
        title TEXT,
        genre TEXT NOT NULL,
        sub_genre TEXT NOT NULL,
        chapter_number INTEGER NOT NULL,
        chapter_name TEXT NOT NULL,
        content TEXT NOT NULL,
        quiz TEXT,
        images TEXT,
        word_count INTEGER NOT NULL DEFAULT 0,
        reading_level TEXT NOT NULL,
        created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(book_id, chapter_number)
      );
    `);

    db.execSync(`
      CREATE TABLE IF NOT EXISTS savings_jug (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        balance REAL NOT NULL DEFAULT 0.0,
        emoji TEXT,
        created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    db.execSync(`
      CREATE TABLE IF NOT EXISTS savings_transaction (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        savings_jug_id INTEGER NOT NULL,
        transaction_name TEXT NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (savings_jug_id) REFERENCES savings_jug (id)
      );
    `);

    db.execSync(`
      CREATE TABLE IF NOT EXISTS learner_reading (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id TEXT NOT NULL,
        chapter_number INTEGER NOT NULL,
        chapter_name TEXT NOT NULL,
        reading_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (book_id) REFERENCES book (book_id)
      );
    `);

    db.execSync(`
      CREATE TABLE IF NOT EXISTS chapter_completion (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        learner_uid TEXT NOT NULL,
        chapter_id INTEGER NOT NULL,
        duration INTEGER NOT NULL,
        score INTEGER NOT NULL,
        completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chapter_id) REFERENCES book (id)
      );
    `);

    // Create indexes for better performance
    db.execSync('CREATE INDEX IF NOT EXISTS idx_question_report_question_id ON question_report (question_id);');
    db.execSync('CREATE INDEX IF NOT EXISTS idx_question_report_date ON question_report (date);');
    db.execSync('CREATE INDEX IF NOT EXISTS idx_question_report_outcome ON question_report (outcome);');
    db.execSync('CREATE INDEX IF NOT EXISTS idx_book_genre ON book (genre);');
    db.execSync('CREATE INDEX IF NOT EXISTS idx_book_sub_genre ON book (sub_genre);');
    db.execSync('CREATE INDEX IF NOT EXISTS idx_book_reading_level ON book (reading_level);');
    db.execSync('CREATE INDEX IF NOT EXISTS idx_book_chapter_number ON book (chapter_number);');
    db.execSync('CREATE INDEX IF NOT EXISTS idx_savings_jug_name ON savings_jug (name);');
    db.execSync('CREATE INDEX IF NOT EXISTS idx_savings_transaction_jug_id ON savings_transaction (savings_jug_id);');
    db.execSync('CREATE INDEX IF NOT EXISTS idx_savings_transaction_date ON savings_transaction (date);');
    db.execSync('CREATE INDEX IF NOT EXISTS idx_chapter_completion_learner_uid ON chapter_completion (learner_uid);');
    db.execSync('CREATE INDEX IF NOT EXISTS idx_chapter_completion_chapter_id ON chapter_completion (chapter_id);');
    db.execSync('CREATE INDEX IF NOT EXISTS idx_chapter_completion_completed_at ON chapter_completion (completed_at);');

    console.log('Tables created successfully');
  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  }
};

// Question Report Functions
export const insertQuestionReport = (questionId: string, outcome: 'correct' | 'incorrect'): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      db.runSync('INSERT INTO question_report (question_id, outcome) VALUES (?, ?)', [questionId, outcome]);
      console.log('Question report inserted successfully');
      resolve();
    } catch (error) {
      console.error('Error inserting question report:', error);
      reject(error);
    }
  });
};

export const getQuestionReports = (): Promise<Array<{ id: number; question_id: string; outcome: string; date: string; created: string }>> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getAllSync<{ id: number; question_id: string; outcome: string; date: string; created: string }>(
        'SELECT * FROM question_report ORDER BY date DESC'
      );
      resolve(result);
    } catch (error) {
      console.error('Error fetching question reports:', error);
      reject(error);
    }
  });
};

export const getQuestionReportsByQuestionId = (questionId: string): Promise<Array<{ id: number; question_id: string; outcome: string; date: string; created: string }>> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getAllSync<{ id: number; question_id: string; outcome: string; date: string; created: string }>(
        'SELECT * FROM question_report WHERE question_id = ? ORDER BY date DESC',
        [questionId]
      );
      resolve(result);
    } catch (error) {
      console.error('Error fetching question reports by question ID:', error);
      reject(error);
    }
  });
};

export const deleteQuestionReport = (id: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      db.runSync('DELETE FROM question_report WHERE id = ?', [id]);
      console.log('Question report deleted successfully');
      resolve();
    } catch (error) {
      console.error('Error deleting question report:', error);
      reject(error);
    }
  });
};

export const clearAllQuestionReports = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      db.runSync('DELETE FROM question_report');
      console.log('All question reports cleared successfully');
      resolve();
    } catch (error) {
      console.error('Error clearing question reports:', error);
      reject(error);
    }
  });
};

// Book Functions
export const insertBook = (bookData: {
  book_id: string;
  title?: string;
  genre: string;
  sub_genre: string;
  chapter_number: number;
  chapter_name: string;
  content: string;
  quiz?: string;
  images?: string;
  word_count: number;
  reading_level: string;
}): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      db.runSync(`
        INSERT OR REPLACE INTO book (
          book_id, title, genre, sub_genre, chapter_number, chapter_name, content, 
          quiz, images, word_count, reading_level
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        bookData.book_id,
        bookData.title || null,
        bookData.genre,
        bookData.sub_genre,
        bookData.chapter_number,
        bookData.chapter_name,
        bookData.content,
        bookData.quiz || null,
        bookData.images || null,
        bookData.word_count,
        bookData.reading_level
      ]);
      console.log('Book inserted successfully');
      resolve();
    } catch (error) {
      console.error('Error inserting book:', error);
      reject(error);
    }
  });
};

export const getAllBooks = (): Promise<Array<{
  id: number;
  book_id: string;
  title: string | null;
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
}>> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getAllSync<{
        id: number;
        book_id: string;
        title: string | null;
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
      }>(
        'SELECT * FROM book ORDER BY genre, sub_genre, chapter_number'
      );
      resolve(result);
    } catch (error) {
      console.error('Error fetching books:', error);
      reject(error);
    }
  });
};

export const getBooksByGenre = (genre: string): Promise<Array<{
  id: number;
  book_id: string;
  title: string | null;
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
}>> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getAllSync<{
        id: number;
        book_id: string;
        title: string | null;
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
      }>(
        'SELECT * FROM book WHERE genre = ? ORDER BY sub_genre, chapter_number',
        [genre]
      );
      resolve(result);
    } catch (error) {
      console.error('Error fetching books by genre:', error);
      reject(error);
    }
  });
};

export const getBooksByReadingLevel = (readingLevel: string): Promise<Array<{
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
}>> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getAllSync<{
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
      }>(
        'SELECT * FROM book WHERE reading_level = ? ORDER BY genre, sub_genre, chapter_number',
        [readingLevel]
      );
      resolve(result);
    } catch (error) {
      console.error('Error fetching books by reading level:', error);
      reject(error);
    }
  });
};

export const getBookById = (bookId: string): Promise<{
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
} | null> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getFirstSync<{
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
      }>(
        'SELECT * FROM book WHERE book_id = ?',
        [bookId]
      );
      resolve(result || null);
    } catch (error) {
      console.error('Error fetching book by ID:', error);
      reject(error);
    }
  });
};

export const updateBook = (bookId: string, bookData: {
  genre?: string;
  sub_genre?: string;
  chapter_number?: number;
  chapter_name?: string;
  content?: string;
  quiz?: string;
  images?: string;
  word_count?: number;
  reading_level?: string;
}): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const updates: string[] = [];
      const values: any[] = [];

      if (bookData.genre !== undefined) {
        updates.push('genre = ?');
        values.push(bookData.genre);
      }
      if (bookData.sub_genre !== undefined) {
        updates.push('sub_genre = ?');
        values.push(bookData.sub_genre);
      }
      if (bookData.chapter_number !== undefined) {
        updates.push('chapter_number = ?');
        values.push(bookData.chapter_number);
      }
      if (bookData.chapter_name !== undefined) {
        updates.push('chapter_name = ?');
        values.push(bookData.chapter_name);
      }
      if (bookData.content !== undefined) {
        updates.push('content = ?');
        values.push(bookData.content);
      }
      if (bookData.quiz !== undefined) {
        updates.push('quiz = ?');
        values.push(bookData.quiz);
      }
      if (bookData.images !== undefined) {
        updates.push('images = ?');
        values.push(bookData.images);
      }
      if (bookData.word_count !== undefined) {
        updates.push('word_count = ?');
        values.push(bookData.word_count);
      }
      if (bookData.reading_level !== undefined) {
        updates.push('reading_level = ?');
        values.push(bookData.reading_level);
      }

      updates.push('updated = CURRENT_TIMESTAMP');
      values.push(bookId);

      const query = `UPDATE book SET ${updates.join(', ')} WHERE book_id = ?`;
      db.runSync(query, values);
      console.log('Book updated successfully');
      resolve();
    } catch (error) {
      console.error('Error updating book:', error);
      reject(error);
    }
  });
};

export const deleteBook = (bookId: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      db.runSync('DELETE FROM book WHERE book_id = ?', [bookId]);
      console.log('Book deleted successfully');
      resolve();
    } catch (error) {
      console.error('Error deleting book:', error);
      reject(error);
    }
  });
};

export const getBookStatistics = (): Promise<{
  total_books: number;
  total_chapters: number;
  total_word_count: number;
  genres_count: number;
  reading_levels_count: number;
  average_word_count: number;
}> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getFirstSync<{
        total_books: number;
        total_chapters: number;
        total_word_count: number;
        genres_count: number;
        reading_levels_count: number;
        average_word_count: number;
      }>(
        `SELECT 
          COUNT(DISTINCT book_id) as total_books,
          COUNT(*) as total_chapters,
          SUM(word_count) as total_word_count,
          COUNT(DISTINCT genre) as genres_count,
          COUNT(DISTINCT reading_level) as reading_levels_count,
          ROUND(AVG(word_count), 0) as average_word_count
        FROM book`
      );
      resolve(result || {
        total_books: 0,
        total_chapters: 0,
        total_word_count: 0,
        genres_count: 0,
        reading_levels_count: 0,
        average_word_count: 0
      });
    } catch (error) {
      console.error('Error fetching book statistics:', error);
      reject(error);
    }
  });
};

// Savings Functions
export const insertSavingsJug = (jugData: { name: string; emoji: string }): Promise<number> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.runSync('INSERT INTO savings_jug (name, emoji) VALUES (?, ?)', [jugData.name, jugData.emoji]);
      console.log('Savings jug inserted successfully');
      resolve(result.lastInsertRowId);
    } catch (error) {
      console.error('Error inserting savings jar:', error);
      reject(error);
    }
  });
};

export const getAllSavingsJugs = (): Promise<Array<{
  id: number;
  name: string;
  balance: number;
  emoji: string;
  created: string;
  updated: string;
}>> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getAllSync<{
        id: number;
        name: string;
        balance: number;
        emoji: string;
        created: string;
        updated: string;
      }>(
        'SELECT * FROM savings_jug ORDER BY created DESC'
      );
      resolve(result);
    } catch (error) {
      console.error('Error fetching savings jars:', error);
      reject(error);
    }
  });
};

export const getSavingsJugById = (id: number): Promise<{
  id: number;
  name: string;
  balance: number;
  emoji: string;
  created: string;
  updated: string;
} | null> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getFirstSync<{
        id: number;
        name: string;
        balance: number;
        emoji: string;
        created: string;
        updated: string;
      }>(
        'SELECT * FROM savings_jug WHERE id = ?',
        [id]
      );
      resolve(result || null);
    } catch (error) {
      console.error('Error fetching savings jar by ID:', error);
      reject(error);
    }
  });
};

export const updateSavingsJug = (id: number, jugData: { name?: string; balance?: number }): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const updates: string[] = [];
      const values: any[] = [];

      if (jugData.name !== undefined) {
        updates.push('name = ?');
        values.push(jugData.name);
      }
      if (jugData.balance !== undefined) {
        updates.push('balance = ?');
        values.push(jugData.balance);
      }

      updates.push('updated = CURRENT_TIMESTAMP');
      values.push(id);

      const query = `UPDATE savings_jug SET ${updates.join(', ')} WHERE id = ?`;
      db.runSync(query, values);
      console.log('Savings jug updated successfully');
      resolve();
    } catch (error) {
      console.error('Error updating savings jar:', error);
      reject(error);
    }
  });
};

export const deleteSavingsJug = (id: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      // First delete all transactions for this jug
      db.runSync('DELETE FROM savings_transaction WHERE savings_jug_id = ?', [id]);
      // Then delete the jug
      db.runSync('DELETE FROM savings_jug WHERE id = ?', [id]);
      console.log('Savings jug deleted successfully');
      resolve();
    } catch (error) {
      console.error('Error deleting savings jar:', error);
      reject(error);
    }
  });
};

export const insertSavingsTransaction = (transactionData: {
  savings_jug_id: number;
  transaction_name: string;
  amount: number;
}): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      db.runSync(
        'INSERT INTO savings_transaction (savings_jug_id, transaction_name, amount) VALUES (?, ?, ?)',
        [transactionData.savings_jug_id, transactionData.transaction_name, transactionData.amount]
      );
      console.log('Savings transaction inserted successfully');
      resolve();
    } catch (error) {
      console.error('Error inserting savings transaction:', error);
      reject(error);
    }
  });
};

export const getSavingsTransactionsByJugId = (jugId: number): Promise<Array<{
  id: number;
  savings_jug_id: number;
  transaction_name: string;
  amount: number;
  date: string;
  created: string;
}>> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getAllSync<{
        id: number;
        savings_jug_id: number;
        transaction_name: string;
        amount: number;
        date: string;
        created: string;
      }>(
        'SELECT * FROM savings_transaction WHERE savings_jug_id = ? ORDER BY date DESC',
        [jugId]
      );
      resolve(result);
    } catch (error) {
      console.error('Error fetching savings transactions:', error);
      reject(error);
    }
  });
};

export const getSavingsStatistics = (): Promise<{
  total_jugs: number;
  total_balance: number;
  total_transactions: number;
  average_balance: number;
}> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getFirstSync<{
        total_jugs: number;
        total_balance: number;
        total_transactions: number;
        average_balance: number;
      }>(
        `SELECT 
          COUNT(*) as total_jugs,
          SUM(balance) as total_balance,
          (SELECT COUNT(*) FROM savings_transaction) as total_transactions,
          ROUND(AVG(balance), 2) as average_balance
        FROM savings_jug`
      );
      resolve(result || {
        total_jugs: 0,
        total_balance: 0,
        total_transactions: 0,
        average_balance: 0
      });
    } catch (error) {
      console.error('Error fetching savings statistics:', error);
      reject(error);
    }
  });
};

// Update savings jar balance
export const updateSavingsJugBalance = (id: number, balance: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      db.runSync('UPDATE savings_jug SET balance = ?, updated = CURRENT_TIMESTAMP WHERE id = ?', [balance, id]);
      console.log('Savings jug balance updated successfully');
      resolve();
    } catch (error) {
      console.error('Error updating savings jar balance:', error);
      reject(error);
    }
  });
};

// Get all savings transactions
export const getAllSavingsTransactions = (): Promise<Array<{
  id: number;
  savings_jug_id: number;
  transaction_name: string;
  amount: number;
  date: string;
  created: string;
}>> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getAllSync<{
        id: number;
        savings_jug_id: number;
        transaction_name: string;
        amount: number;
        date: string;
        created: string;
      }>(
        'SELECT * FROM savings_transaction ORDER BY date DESC'
      );
      resolve(result);
    } catch (error) {
      console.error('Error fetching all savings transactions:', error);
      reject(error);
    }
  });
};

// Get savings jar with transactions
export const getSavingsJugWithTransactions = (jugId: number): Promise<{
  jug: {
    id: number;
    name: string;
    balance: number;
    created: string;
    updated: string;
  };
  transactions: Array<{
    id: number;
    savings_jug_id: number;
    transaction_name: string;
    amount: number;
    date: string;
    created: string;
  }>;
} | null> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const jug = db.getFirstSync<{
        id: number;
        name: string;
        balance: number;
        created: string;
        updated: string;
      }>(
        'SELECT * FROM savings_jug WHERE id = ?',
        [jugId]
      );

      if (!jug) {
        resolve(null);
        return;
      }

      const transactions = db.getAllSync<{
        id: number;
        savings_jug_id: number;
        transaction_name: string;
        amount: number;
        date: string;
        created: string;
      }>(
        'SELECT * FROM savings_transaction WHERE savings_jug_id = ? ORDER BY date DESC',
        [jugId]
      );

      resolve({
        jug,
        transactions
      });
    } catch (error) {
      console.error('Error fetching savings jar with transactions:', error);
      reject(error);
    }
  });
};

// Clear all savings data
export const clearAllSavingsData = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      // Delete all transactions first (due to foreign key constraint)
      db.runSync('DELETE FROM savings_transaction');
      // Then delete all jugs
      db.runSync('DELETE FROM savings_jug');
      console.log('All savings data cleared successfully');
      resolve();
    } catch (error) {
      console.error('Error clearing savings data:', error);
      reject(error);
    }
  });
};

// Learner Reading Functions
export const getCurrentReading = (): Promise<{
  id: number;
  book_id: string;
  chapter_number: number;
  chapter_name: string;
  reading_date: string;
  created: string;
} | null> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      // First, let's see all reading entries
      const allReadings = db.getAllSync<{
        id: number;
        book_id: string;
        chapter_number: number;
        chapter_name: string;
        reading_date: string;
        created: string;
      }>('SELECT * FROM learner_reading ORDER BY reading_date DESC');
      
      console.log(`[getCurrentReading] All reading entries:`, allReadings.map(r => `${r.book_id}:${r.chapter_number}:${r.chapter_name}`));
      
      const result = db.getFirstSync<{
        id: number;
        book_id: string;
        chapter_number: number;
        chapter_name: string;
        reading_date: string;
        created: string;
      }>(
        'SELECT * FROM learner_reading ORDER BY reading_date DESC LIMIT 1'
      );
      
      if (result) {
        console.log(`[getCurrentReading] Returning: ${result.book_id}:${result.chapter_number}:${result.chapter_name}`);
      } else {
        console.log(`[getCurrentReading] No reading entry found`);
      }
      
      resolve(result || null);
    } catch (error) {
      console.error('Error fetching current reading:', error);
      reject(error);
    }
  });
};

export const startReadingBook = (bookData: {
  book_id: string;
  chapter_number: number;
  chapter_name: string;
}): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      // First, clear any existing reading progress
      db.runSync('DELETE FROM learner_reading');
      
      // Start reading the new book
      db.runSync(
        'INSERT INTO learner_reading (book_id, chapter_number, chapter_name) VALUES (?, ?, ?)',
        [bookData.book_id, bookData.chapter_number, bookData.chapter_name]
      );
      console.log('Started reading book successfully');
      resolve();
    } catch (error) {
      console.error('Error starting reading book:', error);
      reject(error);
    }
  });
};

export const updateReadingProgress = (bookData: {
  book_id: string;
  chapter_number: number;
  chapter_name: string;
}): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      console.log(`[updateReadingProgress] Updating reading progress: book_id=${bookData.book_id}, chapter_number=${bookData.chapter_number}, chapter_name=${bookData.chapter_name}`);
      
      // First, let's see what's currently in the learner_reading table
      const currentReadings = db.getAllSync<{
        id: number;
        book_id: string;
        chapter_number: number;
        chapter_name: string;
        reading_date: string;
      }>('SELECT * FROM learner_reading WHERE book_id = ? ORDER BY reading_date DESC', [bookData.book_id]);
      
      console.log(`[updateReadingProgress] Current readings for book_id ${bookData.book_id}:`, currentReadings.map(r => `${r.chapter_number}:${r.chapter_name}`));
      
      db.runSync(
        'UPDATE learner_reading SET chapter_number = ?, chapter_name = ?, reading_date = CURRENT_TIMESTAMP WHERE book_id = ?',
        [bookData.chapter_number, bookData.chapter_name, bookData.book_id]
      );
      
      // Check what was updated
      const updatedReadings = db.getAllSync<{
        id: number;
        book_id: string;
        chapter_number: number;
        chapter_name: string;
        reading_date: string;
      }>('SELECT * FROM learner_reading WHERE book_id = ? ORDER BY reading_date DESC', [bookData.book_id]);
      
      console.log(`[updateReadingProgress] Updated readings for book_id ${bookData.book_id}:`, updatedReadings.map(r => `${r.chapter_number}:${r.chapter_name}`));
      
      console.log('Updated reading progress successfully');
      resolve();
    } catch (error) {
      console.error('Error updating reading progress:', error);
      reject(error);
    }
  });
};

export const getRandomBook = (): Promise<{
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
} | null> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getFirstSync<{
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
      }>(
        'SELECT * FROM book ORDER BY RANDOM() LIMIT 1'
      );
      resolve(result || null);
    } catch (error) {
      console.error('Error fetching random book:', error);
      reject(error);
    }
  });
};

export const getRandomBookByReadingLevel = (readingLevel: string): Promise<{
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
} | null> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getFirstSync<{
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
      }>(
        'SELECT * FROM book WHERE reading_level = ? ORDER BY RANDOM() LIMIT 1',
        [readingLevel]
      );
      resolve(result || null);
    } catch (error) {
      console.error('Error fetching random book by reading level:', error);
      reject(error);
    }
  });
};

export const getRandomUncompletedBook = (learnerUid: string): Promise<{
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
} | null> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      // Get a random book that the user hasn't completed with a score of 80+
      const result = db.getFirstSync<{
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
      }>(
        `SELECT b.* FROM book b
         WHERE b.id NOT IN (
           SELECT cc.chapter_id 
           FROM chapter_completion cc 
           WHERE cc.learner_uid = ? AND cc.score >= 80
         )
         ORDER BY RANDOM() 
         LIMIT 1`,
        [learnerUid]
      );
      resolve(result || null);
    } catch (error) {
      console.error('Error fetching random uncompleted book:', error);
      reject(error);
    }
  });
};

export const getRandomUncompletedBookByReadingLevel = (learnerUid: string, readingLevel: string): Promise<{
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
} | null> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      // Get all uncompleted books at the specified reading level, but only chapter 1
      const allUncompleted = db.getAllSync<{
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
      }>(
        `SELECT b.* FROM book b
         WHERE b.reading_level = ? 
         AND b.chapter_number = 1
         AND b.id NOT IN (
           SELECT cc.chapter_id 
           FROM chapter_completion cc 
           WHERE cc.learner_uid = ? AND cc.score >= 80
         )`,
        [readingLevel, learnerUid]
      );
      console.log('[getRandomUncompletedBookByReadingLevel] Uncompleted books at level', readingLevel, ':', allUncompleted.map(b => `${b.book_id}:${b.chapter_number}:${b.chapter_name}`).join(', '));

      // Get a random book at the specified reading level that the user hasn't completed with a score of 80+, but only chapter 1
      const result = db.getFirstSync<{
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
      }>(
        `SELECT b.* FROM book b
         WHERE b.reading_level = ? 
         AND b.chapter_number = 1
         AND b.id NOT IN (
           SELECT cc.chapter_id 
           FROM chapter_completion cc 
           WHERE cc.learner_uid = ? AND cc.score >= 80
         )
         ORDER BY RANDOM() 
         LIMIT 1`,
        [readingLevel, learnerUid]
      );
      resolve(result || null);
    } catch (error) {
      console.error('Error fetching random uncompleted book by reading level:', error);
      reject(error);
    }
  });
};

export const finishReadingBook = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      db.runSync('DELETE FROM learner_reading');
      console.log('Finished reading book successfully');
      resolve();
    } catch (error) {
      console.error('Error finishing reading book:', error);
      reject(error);
    }
  });
};

export const clearLearnerReadingTable = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      db.runSync('DELETE FROM learner_reading');
      console.log('Learner reading table cleared successfully');
      resolve();
    } catch (error) {
      console.error('Error clearing learner reading table:', error);
      reject(error);
    }
  });
};

export const getBookByChapterId = (chapterId: number): Promise<{
  id: number;
  book_id: string;
  title: string | null;
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
} | null> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getFirstSync<{
        id: number;
        book_id: string;
        title: string | null;
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
      }>(
        'SELECT * FROM book WHERE id = ?',
        [chapterId]
      );
      resolve(result || null);
    } catch (error) {
      console.error('Error fetching book by chapter ID:', error);
      reject(error);
    }
  });
};

export const getBookByBookIdAndChapterNumber = (bookId: string, chapterNumber: number): Promise<{
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
} | null> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      console.log(`[getBookByBookIdAndChapterNumber] Looking for book_id=${bookId}, chapter_number=${chapterNumber}`);
      
      const result = db.getFirstSync<{
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
      }>(
        'SELECT * FROM book WHERE book_id = ? AND chapter_number = ?',
        [bookId, chapterNumber]
      );
      
      if (result) {
        console.log(`[getBookByBookIdAndChapterNumber] Found: ${result.chapter_name} (${result.reading_level})`);
      } else {
        console.log(`[getBookByBookIdAndChapterNumber] No book found for book_id=${bookId}, chapter_number=${chapterNumber}`);
      }
      
      resolve(result || null);
    } catch (error) {
      console.error('Error fetching book by book ID and chapter number:', error);
      reject(error);
    }
  });
};

export const insertChapterCompletion = (completionData: {
  learnerUid: string;
  chapterId: number;
  readingSpeed: number;
  score: number;
}): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      db.runSync(
        'INSERT INTO chapter_completion (learner_uid, chapter_id, duration, score) VALUES (?, ?, ?, ?)',
        [completionData.learnerUid, completionData.chapterId, completionData.readingSpeed, completionData.score]
      );
      console.log('Chapter completion recorded successfully');
      resolve();
    } catch (error) {
      console.error('Error recording chapter completion:', error);
      reject(error);
    }
  });
};

export const getChapterCompletionStats = (learnerUid: string): Promise<{
  totalChaptersCompleted: number;
  averageScore: number;
  totalReadingTime: number;
  averageReadingTime: number;
}> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getFirstSync<{
        totalChaptersCompleted: number;
        averageScore: number;
        totalReadingTime: number;
        averageReadingTime: number;
      }>(
        `SELECT 
          COUNT(*) as totalChaptersCompleted,
          AVG(score) as averageScore,
          SUM(duration) as totalReadingTime,
          AVG(duration) as averageReadingTime
        FROM chapter_completion 
        WHERE learner_uid = ?`,
        [learnerUid]
      );
      
      resolve(result || {
        totalChaptersCompleted: 0,
        averageScore: 0,
        totalReadingTime: 0,
        averageReadingTime: 0
      });
    } catch (error) {
      console.error('Error fetching chapter completion stats:', error);
      reject(error);
    }
  });
};

export const getAllCompletedChapters = (): Promise<Array<{
  id: number;
  learner_uid: string;
  chapter_id: number;
  duration: number;
  score: number;
  completed_at: string;
  created: string;
  book_id: string;
  genre: string;
  sub_genre: string;
  chapter_number: number;
  chapter_name: string;
  reading_level: string;
}>> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getAllSync<{
        id: number;
        learner_uid: string;
        chapter_id: number;
        duration: number;
        score: number;
        completed_at: string;
        created: string;
        book_id: string;
        genre: string;
        sub_genre: string;
        chapter_number: number;
        chapter_name: string;
        reading_level: string;
      }>(
        `SELECT 
          cc.id,
          cc.learner_uid,
          cc.chapter_id,
          cc.duration,
          cc.score,
          cc.completed_at,
          cc.created,
          b.book_id,
          b.genre,
          b.sub_genre,
          b.chapter_number,
          b.chapter_name,
          b.reading_level
        FROM chapter_completion cc
        JOIN book b ON cc.chapter_id = b.id
        ORDER BY cc.completed_at DESC`
      );
      resolve(result || []);
    } catch (error) {
      console.error('Error fetching completed chapters:', error);
      reject(error);
    }
  });
};

export const clearAllCompletedChapters = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      db.runSync('DELETE FROM chapter_completion');
      console.log('All completed chapters cleared successfully');
      resolve();
    } catch (error) {
      console.error('Error clearing completed chapters:', error);
      reject(error);
    }
  });
};

export const clearAllBooks = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      db.runSync('DELETE FROM book');
      console.log('All books cleared successfully');
      resolve();
    } catch (error) {
      console.error('Error clearing books:', error);
      reject(error);
    }
  });
};

export const isChapterCompleted = (chapterId: number): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getFirstSync<{ count: number }>(
        'SELECT COUNT(*) as count FROM chapter_completion WHERE chapter_id = ?',
        [chapterId]
      );
      resolve((result?.count || 0) > 0);
    } catch (error) {
      console.error('Error checking if chapter is completed:', error);
      reject(error);
    }
  });
};

export const hasUserCompletedChapter = (learnerUid: string, chapterId: number): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getFirstSync<{ count: number }>(
        'SELECT COUNT(*) as count FROM chapter_completion WHERE learner_uid = ? AND chapter_id = ?',
        [learnerUid, chapterId]
      );
      resolve((result?.count || 0) > 0);
    } catch (error) {
      console.error('Error checking if user has completed chapter:', error);
      reject(error);
    }
  });
};

export const hasUserCompletedChapterWithScore = (learnerUid: string, chapterId: number, minScore: number = 80): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getFirstSync<{ count: number }>(
        'SELECT COUNT(*) as count FROM chapter_completion WHERE learner_uid = ? AND chapter_id = ? AND score >= ?',
        [learnerUid, chapterId, minScore]
      );
      resolve((result?.count || 0) > 0);
    } catch (error) {
      console.error('Error checking if user has completed chapter with score:', error);
      reject(error);
    }
  });
};

export const getNextChapter = (bookId: string, currentChapterNumber: number): Promise<{
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
} | null> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getFirstSync<{
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
      }>(
        'SELECT * FROM book WHERE book_id = ? AND chapter_number > ? ORDER BY chapter_number ASC LIMIT 1',
        [bookId, currentChapterNumber]
      );
      resolve(result || null);
    } catch (error) {
      console.error('Error fetching next chapter:', error);
      reject(error);
    }
  });
};

export const getNextChapterByReadingLevel = (bookId: string, currentChapterNumber: number, readingLevel: string): Promise<{
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
} | null> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      console.log(`[getNextChapterByReadingLevel] Looking for next chapter: book_id=${bookId}, currentChapter=${currentChapterNumber}, readingLevel=${readingLevel}`);
      
      // First, let's debug what chapters exist for this book_id
      const allChaptersForBook = db.getAllSync<{
        id: number;
        book_id: string;
        chapter_number: number;
        chapter_name: string;
        reading_level: string;
      }>(
        'SELECT id, book_id, chapter_number, chapter_name, reading_level FROM book WHERE book_id = ? ORDER BY chapter_number ASC',
        [bookId]
      );
      
      console.log(`[getNextChapterByReadingLevel] All chapters for book ${bookId}:`, allChaptersForBook.map(ch => `${ch.chapter_number}:${ch.chapter_name}(${ch.reading_level})`));
      
      // Now get the next chapter with the specific criteria
      const query = 'SELECT * FROM book WHERE book_id = ? AND chapter_number > ? AND reading_level = ? ORDER BY chapter_number ASC LIMIT 1';
      const params = [bookId, currentChapterNumber, readingLevel];
      console.log(`[getNextChapterByReadingLevel] Executing query: ${query} with params:`, params);
      
      const result = db.getFirstSync<{
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
      }>(query, params);
      
      if (result) {
        console.log(`[getNextChapterByReadingLevel] Found next chapter: ${result.chapter_number}:${result.chapter_name} (${result.reading_level})`);
      } else {
        console.log(`[getNextChapterByReadingLevel] No next chapter found for book_id=${bookId}, currentChapter=${currentChapterNumber}, readingLevel=${readingLevel}`);
        
        // Let's see what chapters would match without the reading level filter
        const chaptersWithoutLevelFilter = db.getAllSync<{
          chapter_number: number;
          chapter_name: string;
          reading_level: string;
        }>(
          'SELECT chapter_number, chapter_name, reading_level FROM book WHERE book_id = ? AND chapter_number > ? ORDER BY chapter_number ASC',
          [bookId, currentChapterNumber]
        );
        
        console.log(`[getNextChapterByReadingLevel] Chapters without reading level filter:`, chaptersWithoutLevelFilter.map(ch => `${ch.chapter_number}:${ch.chapter_name}(${ch.reading_level})`));
      }
      
      resolve(result || null);
    } catch (error) {
      console.error('Error fetching next chapter by reading level:', error);
      reject(error);
    }
  });
};

export const getQuickReportData = (learnerUid?: string): Promise<{
  booksRead: number;
  totalEarned: number;
  totalReadingTime: number;
}> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      let readingTimeQuery = 'SELECT COALESCE(SUM(duration), 0) as total_time FROM chapter_completion';
      let booksQuery = `SELECT COUNT(DISTINCT b.book_id) as count 
                       FROM chapter_completion cc
                       JOIN book b ON cc.chapter_id = b.id`;
      
      // If learnerUid is provided, filter by user and score >= 80
      if (learnerUid) {
        readingTimeQuery += ' WHERE learner_uid = ? AND score >= 80';
        booksQuery += ' WHERE cc.learner_uid = ? AND cc.score >= 80';
      }
      
      // Get total reading time (duration is in seconds)
      const readingTimeResult = learnerUid 
        ? db.getFirstSync<{ total_time: number }>(readingTimeQuery, [learnerUid])
        : db.getFirstSync<{ total_time: number }>(readingTimeQuery);
      
      // Get total earned from all positive savings transactions
      const earningsResult = db.getFirstSync<{ total: number }>(
        'SELECT COALESCE(SUM(amount), 0) as total FROM savings_transaction WHERE amount > 0'
      );
      
      // Get unique books read (distinct book_ids from completed chapters)
      const booksResult = learnerUid
        ? db.getFirstSync<{ count: number }>(booksQuery, [learnerUid])
        : db.getFirstSync<{ count: number }>(booksQuery);
      
      resolve({
        booksRead: booksResult?.count || 0,
        totalEarned: earningsResult?.total || 0,
        totalReadingTime: readingTimeResult?.total_time || 0
      });
    } catch (error) {
      console.error('Error fetching QuickReport data:', error);
      reject(error);
    }
  });
};

export const getQuickReportDataByPeriod = (learnerUid?: string, period: 'lifetime' | 'week' | 'month' = 'lifetime'): Promise<{
  booksRead: number;
  totalEarned: number;
  totalReadingTime: number;
}> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      // Calculate date filters based on period
      let dateFilter = '';
      let dateParams: string[] = [];
      
      if (period === 'week') {
        dateFilter = 'AND cc.completed_at >= datetime("now", "-7 days")';
      } else if (period === 'month') {
        dateFilter = 'AND cc.completed_at >= datetime("now", "-30 days")';
      }
      
      let readingTimeQuery = `SELECT COALESCE(SUM(cc.duration), 0) as total_time FROM chapter_completion cc WHERE 1=1 ${dateFilter}`;
      let booksQuery = `SELECT COUNT(DISTINCT b.book_id) as count 
                       FROM chapter_completion cc
                       JOIN book b ON cc.chapter_id = b.id
                       WHERE 1=1 ${dateFilter}`;
      
      // If learnerUid is provided, filter by user and score >= 80
      if (learnerUid) {
        readingTimeQuery += ' AND learner_uid = ? AND score >= 80';
        booksQuery += ' AND cc.learner_uid = ? AND cc.score >= 80';
        dateParams = [learnerUid];
      }
      
      // Get total reading time (duration is in seconds)
      const readingTimeResult = learnerUid 
        ? db.getFirstSync<{ total_time: number }>(readingTimeQuery, dateParams)
        : db.getFirstSync<{ total_time: number }>(readingTimeQuery);
      
      // Get total earned from positive savings transactions with date filter
      let earningsQuery = 'SELECT COALESCE(SUM(amount), 0) as total FROM savings_transaction WHERE amount > 0';
      let earningsParams: string[] = [];
      
      if (period === 'week') {
        earningsQuery += ' AND date >= datetime("now", "-7 days")';
      } else if (period === 'month') {
        earningsQuery += ' AND date >= datetime("now", "-30 days")';
      }
      
      const earningsResult = db.getFirstSync<{ total: number }>(earningsQuery, earningsParams);
      
      // Get unique books read (distinct book_ids from completed chapters)
      const booksResult = learnerUid
        ? db.getFirstSync<{ count: number }>(booksQuery, dateParams)
        : db.getFirstSync<{ count: number }>(booksQuery);
      
      resolve({
        booksRead: booksResult?.count || 0,
        totalEarned: earningsResult?.total || 0,
        totalReadingTime: readingTimeResult?.total_time || 0
      });
    } catch (error) {
      console.error('Error fetching QuickReport data by period:', error);
      reject(error);
    }
  });
};

export const getUserCompletedChaptersWithScore = (learnerUid: string, minScore: number = 80): Promise<Array<{
  id: number;
  learner_uid: string;
  chapter_id: number;
  duration: number;
  score: number;
  completed_at: string;
  created: string;
  book_id: string;
  genre: string;
  sub_genre: string;
  chapter_number: number;
  chapter_name: string;
  reading_level: string;
}>> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getAllSync<{
        id: number;
        learner_uid: string;
        chapter_id: number;
        duration: number;
        score: number;
        completed_at: string;
        created: string;
        book_id: string;
        genre: string;
        sub_genre: string;
        chapter_number: number;
        chapter_name: string;
        reading_level: string;
      }>(
        `SELECT 
          cc.id,
          cc.learner_uid,
          cc.chapter_id,
          cc.duration,
          cc.score,
          cc.completed_at,
          cc.created,
          b.book_id,
          b.genre,
          b.sub_genre,
          b.chapter_number,
          b.chapter_name,
          b.reading_level
        FROM chapter_completion cc
        JOIN book b ON cc.chapter_id = b.id
        WHERE cc.learner_uid = ? AND cc.score >= ?
        ORDER BY cc.completed_at DESC`,
        [learnerUid, minScore]
      );
      resolve(result || []);
    } catch (error) {
      console.error('Error fetching user completed chapters with score:', error);
      reject(error);
    }
  });
};

// Get count of unique books completed by a user
export const getUserCompletedBooksCount = (learnerUid: string, minScore: number = 80): Promise<number> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getFirstSync<{ count: number }>(
        `SELECT COUNT(DISTINCT b.book_id) as count
         FROM chapter_completion cc
         JOIN book b ON cc.chapter_id = b.id
         WHERE cc.learner_uid = ? AND cc.score >= ?`,
        [learnerUid, minScore]
      );
      resolve(result?.count || 0);
    } catch (error) {
      console.error('Error fetching user completed books count:', error);
      reject(error);
    }
  });
};

// Function to check if completed chapters table is empty
export const isCompletedChaptersTableEmpty = (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getFirstSync<{ count: number }>(
        'SELECT COUNT(*) as count FROM chapter_completion'
      );
      console.log('Completed chapters table empty:', (result?.count || 0) === 0);
      resolve((result?.count || 0) === 0);
    } catch (error) {
      console.error('Error checking if completed chapters table is empty:', error);
      reject(error);
    }
  });
};

// Function to restore completed chapters from API
export const restoreCompletedChapters = async (learnerUid: string): Promise<void> => {
  console.log('Restoring completed chapters from API for user:', learnerUid);
  return new Promise(async (resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      // Import the API function
      const { fetchCompletedChapters } = require('./api');
      
      console.log('Fetching completed chapters from API for user:', learnerUid);
      const response = await fetchCompletedChapters(learnerUid);
      
      if (!response.completedChapters || response.completedChapters.length === 0) {
        console.log('No completed chapters found in API response');
        resolve();
        return;
      }

      console.log(`Found ${response.completedChapters.length} completed chapters to restore`);

      // Clean up any existing duplicates before restoring
      await removeDuplicateChapterCompletions(learnerUid);

      // For each completed chapter from API, we need to find the corresponding book in our database
      for (const apiChapter of response.completedChapters) {
        try {
          // Find the book by title and chapter name (using the new chapterName field)
          let book = db.getFirstSync<{
            id: number;
            book_id: string;
            title: string;
            chapter_number: number;
            chapter_name: string;
          }>(
            `SELECT id, book_id, title, chapter_number, chapter_name 
             FROM book 
             WHERE title = ? AND chapter_name = ?
             LIMIT 1`,
            [apiChapter.bookTitle, apiChapter.chapterName]
          );

          // If exact match not found, try partial title match
          if (!book) {
            book = db.getFirstSync<{
              id: number;
              book_id: string;
              title: string;
              chapter_number: number;
              chapter_name: string;
            }>(
              `SELECT id, book_id, title, chapter_number, chapter_name 
               FROM book 
               WHERE title LIKE ? AND chapter_name = ?
               LIMIT 1`,
              [`%${apiChapter.bookTitle}%`, apiChapter.chapterName]
            );
          }

          if (book) {
            // Check if this chapter completion already exists for this user
            const existingCompletion = db.getFirstSync<{ count: number }>(
              'SELECT COUNT(*) as count FROM chapter_completion WHERE learner_uid = ? AND chapter_id = ?',
              [learnerUid, book.id]
            );

            if (existingCompletion && existingCompletion.count === 0) {
              // Insert the completed chapter with default values only if it doesn't exist
              db.runSync(
                'INSERT INTO chapter_completion (learner_uid, chapter_id, duration, score, completed_at) VALUES (?, ?, ?, ?, ?)',
                [
                  learnerUid,
                  book.id,
                  300, // Default duration: 5 minutes (300 seconds)
                  85,  // Default score: 85%
                  apiChapter.completedAt
                ]
              );
              console.log(`Restored chapter: ${book.chapter_name} (${book.title})`);
            } else {
              console.log(`Chapter already exists for user, skipping: ${book.chapter_name} (${book.title})`);
            }
          } else {
            console.log(`Book not found in database: ${apiChapter.bookTitle} Chapter ${apiChapter.chapterNumber}`);
          }
        } catch (chapterError) {
          console.error('Error restoring individual chapter:', chapterError);
          // Continue with other chapters even if one fails
        }
      }

      console.log('Completed chapters restoration finished');
      resolve();
    } catch (error) {
      console.error('Error restoring completed chapters:', error);
      reject(error);
    }
  });
};

// Function to manually trigger restoration (for testing/debugging)
export const manuallyRestoreCompletedChapters = async (learnerUid: string): Promise<{
  success: boolean;
  message: string;
  restoredCount: number;
}> => {
  try {
    console.log('Manually triggering completed chapters restoration...');
    
    // Clear existing completed chapters first
    await clearAllCompletedChapters();
    console.log('Cleared existing completed chapters');
    
    // Restore from API
    await restoreCompletedChapters(learnerUid);
    
    // Get count of restored chapters
    const completedChapters = await getAllCompletedChapters();
    
    return {
      success: true,
      message: `Successfully restored ${completedChapters.length} completed chapters`,
      restoredCount: completedChapters.length
    };
  } catch (error) {
    console.error('Error in manual restoration:', error);
    return {
      success: false,
      message: `Failed to restore completed chapters: ${error instanceof Error ? error.message : 'Unknown error'}`,
      restoredCount: 0
    };
  }
};

// Reading level initialization utility
export const initializeReadingLevel = async (): Promise<void> => {
  try {
    const readingLevel = await AsyncStorage.getItem('readingLevel');
    if (!readingLevel) {
      await AsyncStorage.setItem('readingLevel', 'Explorer');
      console.log('Reading level initialized to Explorer');
    }
  } catch (error) {
    console.error('Error initializing reading level:', error);
  }
};

// Get current reading level with fallback to Explorer
export const getCurrentReadingLevel = async (): Promise<string> => {
  try {
    const stored = await AsyncStorage.getItem('readingLevel');
    return stored || 'Explorer';
  } catch (error) {
    console.error('Error getting current reading level:', error);
    return 'Explorer';
  }
};

// Calculate reading streak based on chapter completions
export const calculateReadingStreak = (learnerUid?: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      // Get all completed chapters with dates, ordered by completion date
      let query = `
        SELECT DISTINCT DATE(completed_at) as completion_date
        FROM chapter_completion
        WHERE score >= 80
      `;
      let params: string[] = [];
      
      if (learnerUid) {
        query += ' AND learner_uid = ?';
        params.push(learnerUid);
      }
      
      query += ' ORDER BY completion_date DESC';
      
      const completionDates = db.getAllSync<{ completion_date: string }>(query, params);
      
      if (completionDates.length === 0) {
        resolve(0);
        return;
      }

      // Convert dates to Date objects and sort in descending order
      const dates = completionDates.map(row => new Date(row.completion_date));
      dates.sort((a, b) => b.getTime() - a.getTime());

      // Calculate streak
      let streak = 0;
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      // Check if there's activity today
      const hasActivityToday = dates.some(date => 
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
      );

      if (!hasActivityToday) {
        // No activity today, check if there was activity yesterday
        const hasActivityYesterday = dates.some(date => 
          date.getFullYear() === yesterday.getFullYear() &&
          date.getMonth() === yesterday.getMonth() &&
          date.getDate() === yesterday.getDate()
        );
        
        if (!hasActivityYesterday) {
          resolve(0);
          return;
        }
        // Start counting from yesterday
        streak = 1;
      } else {
        // Start counting from today
        streak = 1;
      }

      // Count consecutive days
      let currentDate = hasActivityToday ? today : yesterday;
      
      for (let i = 1; i < dates.length; i++) {
        const expectedDate = new Date(currentDate);
        expectedDate.setDate(expectedDate.getDate() - 1);
        
        const hasActivityOnExpectedDate = dates.some(date => 
          date.getFullYear() === expectedDate.getFullYear() &&
          date.getMonth() === expectedDate.getMonth() &&
          date.getDate() === expectedDate.getDate()
        );
        
        if (hasActivityOnExpectedDate) {
          streak++;
          currentDate = expectedDate;
        } else {
          break;
        }
      }

      resolve(streak);
    } catch (error) {
      console.error('Error calculating reading streak:', error);
      reject(error);
    }
  });
};

// Get reading streak with additional details
export const getReadingStreakDetails = (learnerUid?: string): Promise<{
  currentStreak: number;
  longestStreak: number;
  totalDaysRead: number;
  lastActivityDate: string | null;
}> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      // Get all completed chapters with dates
      let query = `
        SELECT DISTINCT DATE(completed_at) as completion_date
        FROM chapter_completion
        WHERE score >= 80
      `;
      let params: string[] = [];
      
      if (learnerUid) {
        query += ' AND learner_uid = ?';
        params.push(learnerUid);
      }
      
      query += ' ORDER BY completion_date DESC';
      
      const completionDates = db.getAllSync<{ completion_date: string }>(query, params);
      
      if (completionDates.length === 0) {
        resolve({
          currentStreak: 0,
          longestStreak: 0,
          totalDaysRead: 0,
          lastActivityDate: null
        });
        return;
      }

      // Convert dates to Date objects and sort in descending order
      const dates = completionDates.map(row => new Date(row.completion_date));
      dates.sort((a, b) => b.getTime() - a.getTime());

      const totalDaysRead = dates.length;
      const lastActivityDate = dates[0].toISOString().split('T')[0];

      // Calculate current streak
      let currentStreak = 0;
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const hasActivityToday = dates.some(date => 
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
      );

      if (!hasActivityToday) {
        const hasActivityYesterday = dates.some(date => 
          date.getFullYear() === yesterday.getFullYear() &&
          date.getMonth() === yesterday.getMonth() &&
          date.getDate() === yesterday.getDate()
        );
        
        if (!hasActivityYesterday) {
          currentStreak = 0;
        } else {
          currentStreak = 1;
        }
      } else {
        currentStreak = 1;
      }

      // Calculate current streak length
      let currentDate = hasActivityToday ? today : yesterday;
      
      for (let i = 1; i < dates.length; i++) {
        const expectedDate = new Date(currentDate);
        expectedDate.setDate(expectedDate.getDate() - 1);
        
        const hasActivityOnExpectedDate = dates.some(date => 
          date.getFullYear() === expectedDate.getFullYear() &&
          date.getMonth() === expectedDate.getMonth() &&
          date.getDate() === expectedDate.getDate()
        );
        
        if (hasActivityOnExpectedDate) {
          currentStreak++;
          currentDate = expectedDate;
        } else {
          break;
        }
      }

      // Calculate longest streak
      let longestStreak = 0;
      let tempStreak = 0;
      
      for (let i = 0; i < dates.length; i++) {
        if (i === 0) {
          tempStreak = 1;
        } else {
          const currentDate = dates[i];
          const previousDate = dates[i - 1];
          const dayDiff = Math.floor((previousDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (dayDiff === 1) {
            tempStreak++;
          } else {
            longestStreak = Math.max(longestStreak, tempStreak);
            tempStreak = 1;
          }
        }
      }
      
      longestStreak = Math.max(longestStreak, tempStreak);

      resolve({
        currentStreak,
        longestStreak,
        totalDaysRead,
        lastActivityDate
      });
    } catch (error) {
      console.error('Error getting reading streak details:', error);
      reject(error);
    }
  });
};

// Function to remove duplicate chapter completions for a user
export const removeDuplicateChapterCompletions = (learnerUid: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      // Remove duplicates by keeping only the first occurrence of each chapter_id for the user
      db.runSync(`
        DELETE FROM chapter_completion 
        WHERE id NOT IN (
          SELECT MIN(id) 
          FROM chapter_completion 
          WHERE learner_uid = ? 
          GROUP BY chapter_id
        ) AND learner_uid = ?
      `, [learnerUid, learnerUid]);
      
      console.log('Duplicate chapter completions removed for user:', learnerUid);
      resolve();
    } catch (error) {
      console.error('Error removing duplicate chapter completions:', error);
      reject(error);
    }
  });
};

export default db; 