const { 
  initDatabase, 
  isCompletedChaptersTableEmpty, 
  restoreCompletedChapters,
  getAllCompletedChapters,
  clearAllCompletedChapters
} = require('../services/database');

async function testCompletedChaptersRestoration() {
  try {
    console.log('Initializing database...');
    await initDatabase();
    
    // Test user UID
    const testUserUid = 'u7QWdEea5EYiplncfopB6xU92lk1';
    
    console.log('\n=== Testing Completed Chapters Restoration ===');
    
    // Check if table is empty initially
    const isEmpty = await isCompletedChaptersTableEmpty();
    console.log(`Is completed chapters table empty? ${isEmpty}`);
    
    if (!isEmpty) {
      console.log('Clearing completed chapters table for testing...');
      await clearAllCompletedChapters();
      console.log('Table cleared successfully');
    }
    
    // Verify table is now empty
    const isEmptyAfterClear = await isCompletedChaptersTableEmpty();
    console.log(`Is completed chapters table empty after clear? ${isEmptyAfterClear}`);
    
    // Test restoration
    console.log('\nAttempting to restore completed chapters...');
    await restoreCompletedChapters(testUserUid);
    
    // Check if restoration worked
    const isEmptyAfterRestore = await isCompletedChaptersTableEmpty();
    console.log(`Is completed chapters table empty after restore? ${isEmptyAfterRestore}`);
    
    if (!isEmptyAfterRestore) {
      console.log('\nRestoration successful! Checking restored data...');
      const completedChapters = await getAllCompletedChapters();
      console.log(`Total completed chapters restored: ${completedChapters.length}`);
      
      if (completedChapters.length > 0) {
        console.log('\nRestored chapters:');
        completedChapters.forEach((chapter, index) => {
          console.log(`${index + 1}. ${chapter.chapter_name} (${chapter.genre}/${chapter.sub_genre})`);
          console.log(`   Book ID: ${chapter.book_id}, Chapter: ${chapter.chapter_number}`);
          console.log(`   Score: ${chapter.score}%, Duration: ${chapter.duration}s`);
          console.log(`   Completed: ${chapter.completed_at}`);
          console.log('---');
        });
      }
    } else {
      console.log('No chapters were restored. This could mean:');
      console.log('1. The API returned no completed chapters');
      console.log('2. The books from API were not found in local database');
      console.log('3. There was an error during restoration');
    }
    
    console.log('\n=== Test completed ===');
    
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test
testCompletedChaptersRestoration(); 