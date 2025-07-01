const { 
  initDatabase, 
  removeDuplicateChapterCompletions,
  getAllCompletedChapters,
  insertChapterCompletion,
  clearAllCompletedChapters
} = require('../services/database');

async function testDuplicateRemoval() {
  try {
    console.log('🧹 Testing Duplicate Chapter Completion Removal...\n');
    
    // Initialize database
    await initDatabase();
    console.log('✅ Database initialized');
    
    // Test user UID
    const testUserUid = 'u7QWdEea5EYiplncfopB6xU92lk1';
    console.log(`👤 Testing with user UID: ${testUserUid}\n`);
    
    // Clear existing data
    console.log('🗑️ Clearing existing completed chapters...');
    await clearAllCompletedChapters();
    
    // Create some duplicate entries for testing
    console.log('📝 Creating duplicate entries for testing...');
    const testChapterId = 1;
    
    // Insert the same chapter completion multiple times
    for (let i = 0; i < 3; i++) {
      await insertChapterCompletion({
        learnerUid: testUserUid,
        chapterId: testChapterId,
        readingSpeed: 150 + i * 10,
        score: 85 + i * 5,
      });
      console.log(`Inserted duplicate ${i + 1}`);
    }
    
    // Check how many entries we have
    console.log('\n📊 Before duplicate removal:');
    const beforeChapters = await getAllCompletedChapters();
    console.log(`Total completed chapters: ${beforeChapters.length}`);
    
    if (beforeChapters.length > 0) {
      beforeChapters.forEach((chapter, index) => {
        console.log(`${index + 1}. Chapter ID: ${chapter.chapter_id}, Score: ${chapter.score}%, Reading Speed: ${chapter.readingSpeed} WPM`);
      });
    }
    
    // Remove duplicates
    console.log('\n🧹 Removing duplicates...');
    await removeDuplicateChapterCompletions(testUserUid);
    
    // Check results
    console.log('\n📊 After duplicate removal:');
    const afterChapters = await getAllCompletedChapters();
    console.log(`Total completed chapters: ${afterChapters.length}`);
    
    if (afterChapters.length > 0) {
      afterChapters.forEach((chapter, index) => {
        console.log(`${index + 1}. Chapter ID: ${chapter.chapter_id}, Score: ${chapter.score}%, Reading Speed: ${chapter.readingSpeed} WPM`);
      });
    }
    
    // Verify only one entry remains
    if (afterChapters.length === 1) {
      console.log('\n✅ Success! Only one entry remains after duplicate removal.');
    } else {
      console.log('\n❌ Error! Expected 1 entry, but found', afterChapters.length);
    }
    
    console.log('\n🎉 Test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testDuplicateRemoval(); 