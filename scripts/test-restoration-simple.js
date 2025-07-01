const { 
  initDatabase, 
  manuallyRestoreCompletedChapters,
  getAllCompletedChapters
} = require('../services/database');

async function testRestoration() {
  try {
    console.log('🚀 Testing Completed Chapters Restoration...\n');
    
    // Initialize database
    await initDatabase();
    console.log('✅ Database initialized');
    
    // Test user UID from the example
    const testUserUid = 'u7QWdEea5EYiplncfopB6xU92lk1';
    console.log(`👤 Testing with user UID: ${testUserUid}\n`);
    
    // Check current state
    const currentChapters = await getAllCompletedChapters();
    console.log(`📊 Current completed chapters in database: ${currentChapters.length}`);
    
    // Perform restoration
    console.log('\n🔄 Starting restoration process...');
    const result = await manuallyRestoreCompletedChapters(testUserUid);
    
    console.log('\n📋 Restoration Results:');
    console.log(`✅ Success: ${result.success}`);
    console.log(`💬 Message: ${result.message}`);
    console.log(`📈 Restored Count: ${result.restoredCount}`);
    
    if (result.success && result.restoredCount > 0) {
      console.log('\n📖 Restored Chapters:');
      const restoredChapters = await getAllCompletedChapters();
      restoredChapters.forEach((chapter, index) => {
        console.log(`${index + 1}. ${chapter.chapter_name} (${chapter.genre})`);
        console.log(`   Score: ${chapter.score}%, Duration: ${chapter.duration}s`);
      });
    }
    
    console.log('\n🎉 Test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testRestoration(); 