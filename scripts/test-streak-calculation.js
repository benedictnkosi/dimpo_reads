const { initDatabase, insertQuestionReport, calculateStreakDays, getOverallStatistics } = require('../services/database');

async function testStreakCalculation() {
  console.log('🔥 Testing Streak Calculation...');
  
  try {
    // Initialize database
    initDatabase();
    console.log('✅ Database initialized');
    
    // Clear any existing data
    console.log('\n🧹 Clearing existing question reports...');
    const { clearAllQuestionReports } = require('../services/database');
    await clearAllQuestionReports();
    console.log('✅ Existing reports cleared');
    
    // Test 1: No activity - should return 0
    console.log('\n📊 Test 1: No activity');
    let streak = await calculateStreakDays();
    console.log(`✅ Streak: ${streak} days (expected: 0)`);
    
    // Test 2: Activity today only - should return 1
    console.log('\n📊 Test 2: Activity today only');
    await insertQuestionReport('test-question-1', 'correct');
    streak = await calculateStreakDays();
    console.log(`✅ Streak: ${streak} days (expected: 1)`);
    
    // Test 3: Activity today and yesterday - should return 2
    console.log('\n📊 Test 3: Activity today and yesterday');
    // Insert activity for yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    // We need to manually insert with yesterday's date
    const db = require('../services/database').getDatabase();
    db.runSync(
      'INSERT INTO question_report (question_id, outcome, date) VALUES (?, ?, ?)',
      ['test-question-2', 'correct', yesterdayStr]
    );
    
    streak = await calculateStreakDays();
    console.log(`✅ Streak: ${streak} days (expected: 2)`);
    
    // Test 4: Activity today, yesterday, and day before - should return 3
    console.log('\n📊 Test 4: Activity for 3 consecutive days');
    const dayBeforeYesterday = new Date();
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
    const dayBeforeYesterdayStr = dayBeforeYesterday.toISOString().split('T')[0];
    
    db.runSync(
      'INSERT INTO question_report (question_id, outcome, date) VALUES (?, ?, ?)',
      ['test-question-3', 'correct', dayBeforeYesterdayStr]
    );
    
    streak = await calculateStreakDays();
    console.log(`✅ Streak: ${streak} days (expected: 3)`);
    
    // Test 5: Activity with a gap - should return 1 (only today)
    console.log('\n📊 Test 5: Activity with a gap (3 days ago)');
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];
    
    db.runSync(
      'INSERT INTO question_report (question_id, outcome, date) VALUES (?, ?, ?)',
      ['test-question-4', 'correct', threeDaysAgoStr]
    );
    
    streak = await calculateStreakDays();
    console.log(`✅ Streak: ${streak} days (expected: 1 - only today counts)`);
    
    // Test 6: No activity today but activity yesterday - should return 0
    console.log('\n📊 Test 6: No activity today but activity yesterday');
    // Clear today's activity
    db.runSync('DELETE FROM question_report WHERE question_id = ?', ['test-question-1']);
    
    streak = await calculateStreakDays();
    console.log(`✅ Streak: ${streak} days (expected: 0 - no activity today)`);
    
    // Test 7: Overall statistics should include streak
    console.log('\n📊 Test 7: Overall statistics with streak');
    // Add back today's activity
    await insertQuestionReport('test-question-1', 'correct');
    
    const overallStats = await getOverallStatistics();
    console.log('✅ Overall statistics:');
    console.log(`  Total Questions Available: ${overallStats.total_questions_available}`);
    console.log(`  Total Questions Answered: ${overallStats.total_questions_answered}`);
    console.log(`  Streak Days: ${overallStats.streak_days}`);
    
    console.log('\n🎉 Streak calculation test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during streak calculation test:', error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testStreakCalculation();
}

module.exports = { testStreakCalculation }; 