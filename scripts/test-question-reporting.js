const { initDatabase, insertQuestionReport, getAllQuestionReports, getQuestionStatistics } = require('../services/database');

async function testQuestionReporting() {
  console.log('🧪 Testing Question Reporting...');
  
  try {
    // Initialize database
    initDatabase();
    console.log('✅ Database initialized');
    
    // Test inserting some question reports
    console.log('\n📝 Inserting test question reports...');
    
    await insertQuestionReport('test-question-1', 'correct');
    await insertQuestionReport('test-question-2', 'incorrect');
    await insertQuestionReport('test-question-3', 'correct');
    await insertQuestionReport('test-question-1', 'correct'); // Same question, different attempt
    await insertQuestionReport('test-question-2', 'correct'); // Same question, different attempt
    
    console.log('✅ Test question reports inserted');
    
    // Test retrieving all reports
    console.log('\n📊 Retrieving all question reports...');
    const allReports = await getAllQuestionReports();
    console.log(`✅ Found ${allReports.length} question reports:`);
    
    allReports.forEach((report, index) => {
      console.log(`  ${index + 1}. Question ID: ${report.question_id}, Outcome: ${report.outcome}, Date: ${report.date}`);
    });
    
    // Test retrieving statistics
    console.log('\n📈 Retrieving question statistics...');
    const stats = await getQuestionStatistics();
    console.log('✅ Question statistics:');
    console.log(`  Total Answers: ${stats.total_answers}`);
    console.log(`  Correct Answers: ${stats.correct_answers}`);
    console.log(`  Incorrect Answers: ${stats.incorrect_answers}`);
    console.log(`  Accuracy: ${stats.accuracy_percentage}%`);
    
    console.log('\n🎉 Question reporting test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during question reporting test:', error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testQuestionReporting();
}

module.exports = { testQuestionReporting }; 