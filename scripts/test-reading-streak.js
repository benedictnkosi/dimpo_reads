const { initDatabase, insertChapterCompletion, calculateReadingStreak, getReadingStreakDetails, clearAllCompletedChapters } = require('../services/database');

async function testReadingStreak() {
  console.log('🔥 Testing Reading Streak Calculation...');
  
  try {
    // Initialize database
    initDatabase();
    console.log('✅ Database initialized');
    
    // Clear any existing data
    console.log('\n🧹 Clearing existing chapter completions...');
    await clearAllCompletedChapters();
    console.log('✅ Existing completions cleared');
    
    const testUserUid = 'test-user-123';
    
    // Test 1: No activity - should return 0
    console.log('\n📊 Test 1: No activity');
    let streak = await calculateReadingStreak(testUserUid);
    console.log(`✅ Streak: ${streak} days (expected: 0)`);
    
    // Test 2: Activity today only - should return 1
    console.log('\n📊 Test 2: Activity today only');
    await insertChapterCompletion({
      learnerUid: testUserUid,
      chapterId: 1,
      duration: 120,
      score: 85
    });
    streak = await calculateReadingStreak(testUserUid);
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
      'INSERT INTO chapter_completion (learner_uid, chapter_id, duration, score, completed_at) VALUES (?, ?, ?, ?, ?)',
      [testUserUid, 2, 180, 90, yesterdayStr]
    );
    
    streak = await calculateReadingStreak(testUserUid);
    console.log(`✅ Streak: ${streak} days (expected: 2)`);
    
    // Test 4: Activity for 3 consecutive days - should return 3
    console.log('\n📊 Test 4: Activity for 3 consecutive days');
    const dayBeforeYesterday = new Date();
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
    const dayBeforeYesterdayStr = dayBeforeYesterday.toISOString().split('T')[0];
    
    db.runSync(
      'INSERT INTO chapter_completion (learner_uid, chapter_id, duration, score, completed_at) VALUES (?, ?, ?, ?, ?)',
      [testUserUid, 3, 150, 88, dayBeforeYesterdayStr]
    );
    
    streak = await calculateReadingStreak(testUserUid);
    console.log(`✅ Streak: ${streak} days (expected: 3)`);
    
    // Test 5: Activity with a gap - should return 1 (only today)
    console.log('\n📊 Test 5: Activity with a gap (3 days ago)');
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];
    
    db.runSync(
      'INSERT INTO chapter_completion (learner_uid, chapter_id, duration, score, completed_at) VALUES (?, ?, ?, ?, ?)',
      [testUserUid, 4, 200, 92, threeDaysAgoStr]
    );
    
    streak = await calculateReadingStreak(testUserUid);
    console.log(`✅ Streak: ${streak} days (expected: 1 - only today counts)`);
    
    // Test 6: No activity today but activity yesterday - should return 0
    console.log('\n📊 Test 6: No activity today but activity yesterday');
    // Clear today's activity
    db.runSync('DELETE FROM chapter_completion WHERE learner_uid = ? AND chapter_id = ?', [testUserUid, 1]);
    
    streak = await calculateReadingStreak(testUserUid);
    console.log(`✅ Streak: ${streak} days (expected: 0 - no activity today)`);
    
    // Test 7: Get detailed streak information
    console.log('\n📊 Test 7: Detailed streak information');
    // Add back today's activity
    await insertChapterCompletion({
      learnerUid: testUserUid,
      chapterId: 1,
      duration: 120,
      score: 85
    });
    
    const streakDetails = await getReadingStreakDetails(testUserUid);
    console.log('✅ Streak details:');
    console.log(`  Current Streak: ${streakDetails.currentStreak} days`);
    console.log(`  Longest Streak: ${streakDetails.longestStreak} days`);
    console.log(`  Total Days Read: ${streakDetails.totalDaysRead} days`);
    console.log(`  Last Activity: ${streakDetails.lastActivityDate}`);
    
    console.log('\n🎉 Reading streak calculation test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during reading streak test:', error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testReadingStreak();
}

module.exports = { testReadingStreak }; 