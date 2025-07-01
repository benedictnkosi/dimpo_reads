const { 
  initDatabase, 
  getUserCompletedChaptersWithScore,
  getAllBooks
} = require('../services/database');

async function testChapterLimit() {
  try {
    console.log('Initializing database...');
    await initDatabase();
    
    // Test with a sample user UID
    const testUserUid = 'test-user-123';
    
    console.log('\n=== Testing Chapter Limit Functionality ===');
    
    // Get all books first
    const allBooks = await getAllBooks();
    console.log(`Total books in database: ${allBooks.length}`);
    
    // Get completed chapters for the test user
    const completedChapters = await getUserCompletedChaptersWithScore(testUserUid, 80);
    console.log(`Completed chapters for user ${testUserUid}: ${completedChapters.length}`);
    
    if (completedChapters.length > 0) {
      console.log('Completed chapters:');
      completedChapters.forEach((chapter, index) => {
        console.log(`${index + 1}. ${chapter.chapter_name} (Book ID: ${chapter.book_id})`);
      });
    }
    
    // Test chapter limit logic
    console.log('\n=== Testing Chapter Limit Logic ===');
    const isPremium = false; // Simulate free user
    const chapterLimit = 10;
    
    if (isPremium) {
      console.log('✅ Premium user - no chapter limit');
    } else {
      console.log(`📚 Free user - completed ${completedChapters.length}/${chapterLimit} chapters`);
      
      if (completedChapters.length >= chapterLimit) {
        console.log('🔒 Chapter limit reached! Should show paywall.');
      } else {
        console.log(`✅ Can continue reading. ${chapterLimit - completedChapters.length} free chapters remaining.`);
      }
    }
    
    // Test with different user scenarios
    console.log('\n=== Testing Different User Scenarios ===');
    
    // Scenario 1: New user (0 chapters)
    console.log('\nScenario 1: New user (0 chapters)');
    console.log('Expected: Can read, 10 chapters remaining');
    
    // Scenario 2: User with 5 chapters completed
    console.log('\nScenario 2: User with 5 chapters completed');
    console.log('Expected: Can read, 5 chapters remaining');
    
    // Scenario 3: User with 10 chapters completed
    console.log('\nScenario 3: User with 10 chapters completed');
    console.log('Expected: Should show paywall');
    
    // Scenario 4: Premium user
    console.log('\nScenario 4: Premium user');
    console.log('Expected: No limit, can read unlimited chapters');
    
    console.log('\n=== Chapter Limit Test Complete ===');
    
  } catch (error) {
    console.error('Error testing chapter limit:', error);
  }
}

// Run the test
testChapterLimit(); 