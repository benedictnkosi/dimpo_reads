import * as SQLite from 'expo-sqlite';

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
        book_id TEXT NOT NULL UNIQUE,
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
        updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
        INSERT OR IGNORE INTO book (
          book_id, genre, sub_genre, chapter_number, chapter_name, content, 
          quiz, images, word_count, reading_level
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        bookData.book_id,
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
      db.runSync(
        'UPDATE learner_reading SET chapter_number = ?, chapter_name = ?, reading_date = CURRENT_TIMESTAMP WHERE book_id = ?',
        [bookData.chapter_number, bookData.chapter_name, bookData.book_id]
      );
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

export const getBookByChapterId = (chapterId: number): Promise<{
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

export const insertChapterCompletion = (completionData: {
  learnerUid: string;
  chapterId: number;
  duration: number;
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
        [completionData.learnerUid, completionData.chapterId, completionData.duration, completionData.score]
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

export const getQuickReportData = (): Promise<{
  booksRead: number;
  totalEarned: number;
  chaptersRead: number;
}> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      // Get completed chapters count
      const chaptersResult = db.getFirstSync<{ count: number }>(
        'SELECT COUNT(*) as count FROM chapter_completion'
      );
      
      // Get total earned from all positive savings transactions
      const earningsResult = db.getFirstSync<{ total: number }>(
        'SELECT COALESCE(SUM(amount), 0) as total FROM savings_transaction WHERE amount > 0'
      );
      
      // Get unique books read (distinct book_ids from completed chapters)
      const booksResult = db.getFirstSync<{ count: number }>(
        `SELECT COUNT(DISTINCT b.book_id) as count 
         FROM chapter_completion cc
         JOIN book b ON cc.chapter_id = b.id`
      );
      
      resolve({
        booksRead: booksResult?.count || 0,
        totalEarned: earningsResult?.total || 0,
        chaptersRead: chaptersResult?.count || 0
      });
    } catch (error) {
      console.error('Error fetching QuickReport data:', error);
      reject(error);
    }
  });
};

export default db; 