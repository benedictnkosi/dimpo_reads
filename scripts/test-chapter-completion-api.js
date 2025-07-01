const { 
  initDatabase, 
  getBookByChapterId,
  insertChapterCompletion,
  getAllCompletedChapters
} = require('../services/database');
const { submitCompletedChapter } = require('../services/api');

async function testChapterCompletionAPI() {
  try {
    console.log('🚀 Testing Chapter Completion API Submission...\n');
    
    // Initialize database
    await initDatabase();
    console.log('✅ Database initialized');
    
    // Test user UID
    const testUserUid = 'u7QWdEea5EYiplncfopB6xU92lk1';
    console.log(`👤 Testing with user UID: ${testUserUid}\n`);
    
    // Get a sample book from the database
    const allBooks = await getAllBooks();
    if (allBooks.length === 0) {
      console.log('❌ No books found in database');
      return;
    }
    
    const sampleBook = allBooks[0];
    console.log(`📖 Using sample book: ${sampleBook.book_id} - ${sampleBook.chapter_name}`);
    
    // Test data for API submission
    const testCompletionData = {
      learnerUid: testUserUid,
      chapterName: sampleBook.chapter_name,
      bookTitle: sampleBook.title || sampleBook.book_id,
      readingSpeed: 150, // 150 words per minute
      score: 85
    };
    
    console.log('\n📤 Submitting to API...');
    console.log('API Data:', JSON.stringify(testCompletionData, null, 2));
    
    // Submit to API only if book title is available
    if (sampleBook.title) {
      try {
        await submitCompletedChapter(testCompletionData);
        console.log('✅ API submission successful!');
      } catch (apiError) {
        console.error('❌ API submission failed:', apiError.message);
        return;
      }
    } else {
      console.log('⚠️ Book title not found, skipping API submission');
    }
    
    // Also test local database insertion
    console.log('\n💾 Testing local database insertion...');
    try {
      await insertChapterCompletion({
        learnerUid: testUserUid,
        chapterId: sampleBook.id,
        readingSpeed: testCompletionData.readingSpeed,
        score: testCompletionData.score,
      });
      console.log('✅ Local database insertion successful!');
    } catch (dbError) {
      console.error('❌ Local database insertion failed:', dbError.message);
    }
    
    // Check completed chapters
    console.log('\n📊 Checking completed chapters...');
    const completedChapters = await getAllCompletedChapters();
    console.log(`Total completed chapters: ${completedChapters.length}`);
    
    if (completedChapters.length > 0) {
      const latest = completedChapters[0];
      console.log('Latest completion:');
      console.log(`- Chapter: ${latest.chapter_name}`);
      console.log(`- Score: ${latest.score}%`);
      console.log(`- Duration: ${latest.duration}s`);
      console.log(`- Completed: ${latest.completed_at}`);
    }
    
    console.log('\n🎉 Test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Import getAllBooks function
const { getAllBooks } = require('../services/database');

// Run the test
testChapterCompletionAPI(); 