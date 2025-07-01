import { initDatabase, getAllBooks, getBookByChapterId } from '../services/database.ts';

async function testQuizData() {
  try {
    console.log('🧪 Testing Quiz Data...\n');

    // Initialize database
    console.log('1. Initializing database...');
    initDatabase();
    console.log('✅ Database initialized\n');

    // Get all books
    console.log('2. Getting all books...');
    const allBooks = await getAllBooks();
    console.log(`📚 Total chapters: ${allBooks.length}\n`);

    // Test a few different chapters
    const testChapters = allBooks.slice(0, 5);
    
    for (const chapter of testChapters) {
      console.log(`\n--- Testing Chapter ${chapter.id}: ${chapter.chapter_name} ---`);
      console.log(`Book ID: ${chapter.book_id}`);
      console.log(`Chapter Number: ${chapter.chapter_number}`);
      console.log(`Reading Level: ${chapter.reading_level}`);
      
      // Get the chapter by ID
      const retrievedChapter = await getBookByChapterId(chapter.id);
      
      if (retrievedChapter && retrievedChapter.quiz) {
        try {
          const quizData = JSON.parse(retrievedChapter.quiz);
          console.log(`✅ Quiz found with ${quizData.questions?.length || 0} questions`);
          
          if (quizData.questions && quizData.questions.length > 0) {
            console.log(`First question: "${quizData.questions[0].question}"`);
            console.log(`Correct answer: "${quizData.questions[0].correct_answer}"`);
          }
        } catch (parseError) {
          console.log(`❌ Error parsing quiz JSON: ${parseError.message}`);
        }
      } else {
        console.log('❌ No quiz found for this chapter');
      }
    }

    // Check for duplicate quiz content
    console.log('\n🔍 Checking for duplicate quiz content...');
    const quizContents = new Map();
    
    for (const chapter of allBooks) {
      if (chapter.quiz) {
        const quizHash = chapter.quiz; // Use the raw quiz string as hash
        if (quizContents.has(quizHash)) {
          console.log(`⚠️  Duplicate quiz found!`);
          console.log(`   Chapter ${quizContents.get(quizHash).id}: ${quizContents.get(quizHash).chapter_name}`);
          console.log(`   Chapter ${chapter.id}: ${chapter.chapter_name}`);
        } else {
          quizContents.set(quizHash, chapter);
        }
      }
    }
    
    console.log(`\n📊 Quiz Analysis:`);
    console.log(`   Total chapters: ${allBooks.length}`);
    console.log(`   Chapters with quizzes: ${quizContents.size}`);
    console.log(`   Unique quizzes: ${quizContents.size}`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testQuizData(); 