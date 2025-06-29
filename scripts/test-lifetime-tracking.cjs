const { 
  initDatabase, 
  getAllQuestions, 
  insertQuestionReport, 
  getQuestionStatistics,
  clearAllQuestionReports 
} = require('./database-wrapper.js');

const { 
  getLifetimeStats, 
  updateLifetimeStats, 
  resetLifetimeStats,
  getCombinedLimitInfo,
  checkMilestoneNotification,
  getLifetimeLimit
} = require('../services/lifetimeStats.js');

/**
 * Test lifetime tracking functionality with milestone notifications
 */
async function testLifetimeTracking() {
  console.log('🧪 Testing Lifetime Tracking with Milestone Notifications...');
  
  try {
    // Initialize database
    initDatabase();
    console.log('✅ Database initialized');
    
    // Clear existing data for clean test
    await clearAllQuestionReports();
    await resetLifetimeStats();
    console.log('✅ Cleared existing data');
    
    // Get initial lifetime stats
    console.log('\n📊 Initial lifetime stats:');
    const initialStats = await getLifetimeStats();
    console.log('  - Total answered:', initialStats.totalQuestionsAnswered);
    console.log('  - Remaining questions:', initialStats.remainingQuestions);
    console.log('  - Is limit reached:', initialStats.isLimitReached);
    console.log('  - Lifetime limit:', getLifetimeLimit());
    
    // Test milestone notifications
    console.log('\n🎯 Testing milestone notifications...');
    
    // Test 75% milestone (25 questions remaining)
    console.log('\n📈 Testing 75% milestone (25 questions remaining)...');
    const milestone75 = await checkMilestoneNotification(25);
    console.log('  - Should show:', milestone75.shouldShow);
    console.log('  - Milestone:', milestone75.milestone);
    console.log('  - Message:', milestone75.message);
    
    // Test 50% milestone (50 questions remaining)
    console.log('\n📊 Testing 50% milestone (50 questions remaining)...');
    const milestone50 = await checkMilestoneNotification(50);
    console.log('  - Should show:', milestone50.shouldShow);
    console.log('  - Milestone:', milestone50.milestone);
    console.log('  - Message:', milestone50.message);
    
    // Test 25% milestone (25 questions remaining)
    console.log('\n🚨 Testing 25% milestone (25 questions remaining)...');
    const milestone25 = await checkMilestoneNotification(25);
    console.log('  - Should show:', milestone25.shouldShow);
    console.log('  - Milestone:', milestone25.milestone);
    console.log('  - Message:', milestone25.message);
    
    // Simulate answering questions to reach milestones
    console.log('\n🔄 Simulating question answers...');
    
    // Answer 75 questions (should trigger 75% milestone)
    console.log('\n📝 Answering 75 questions...');
    for (let i = 0; i < 75; i++) {
      const result = await updateLifetimeStats(true);
      if (result.milestoneNotification?.shouldShow) {
        console.log(`  🎉 Milestone reached at question ${i + 1}:`, result.milestoneNotification.milestone);
        console.log(`  📢 Message:`, result.milestoneNotification.message);
      }
    }
    
    // Check stats after 75 questions
    const stats75 = await getLifetimeStats();
    console.log('\n📊 Stats after 75 questions:');
    console.log('  - Total answered:', stats75.totalQuestionsAnswered);
    console.log('  - Remaining questions:', stats75.remainingQuestions);
    console.log('  - Is limit reached:', stats75.isLimitReached);
    
    // Answer 15 more questions (should trigger 50% milestone)
    console.log('\n📝 Answering 15 more questions...');
    for (let i = 0; i < 15; i++) {
      const result = await updateLifetimeStats(true);
      if (result.milestoneNotification?.shouldShow) {
        console.log(`  🎉 Milestone reached at question ${75 + i + 1}:`, result.milestoneNotification.milestone);
        console.log(`  📢 Message:`, result.milestoneNotification.message);
      }
    }
    
    // Check stats after 90 questions
    const stats90 = await getLifetimeStats();
    console.log('\n📊 Stats after 90 questions:');
    console.log('  - Total answered:', stats90.totalQuestionsAnswered);
    console.log('  - Remaining questions:', stats90.remainingQuestions);
    console.log('  - Is limit reached:', stats90.isLimitReached);
    
    // Answer 10 more questions (should trigger 25% milestone)
    console.log('\n📝 Answering 10 more questions...');
    for (let i = 0; i < 10; i++) {
      const result = await updateLifetimeStats(true);
      if (result.milestoneNotification?.shouldShow) {
        console.log(`  🎉 Milestone reached at question ${90 + i + 1}:`, result.milestoneNotification.milestone);
        console.log(`  📢 Message:`, result.milestoneNotification.message);
      }
    }
    
    // Check final stats
    const finalStats = await getLifetimeStats();
    console.log('\n📊 Final stats:');
    console.log('  - Total answered:', finalStats.totalQuestionsAnswered);
    console.log('  - Remaining questions:', finalStats.remainingQuestions);
    console.log('  - Is limit reached:', finalStats.isLimitReached);
    console.log('  - Accuracy:', finalStats.accuracyPercentage + '%');
    
    // Test limit reached
    console.log('\n🚫 Testing limit reached...');
    const canAnswer = await updateLifetimeStats(true);
    console.log('  - Can answer more:', !canAnswer.stats.isLimitReached);
    console.log('  - Remaining questions:', canAnswer.stats.remainingQuestions);
    
    // Test combined limit info
    console.log('\n🔗 Testing combined limit info...');
    const combinedInfo = await getCombinedLimitInfo(null);
    console.log('  - Daily limit reached:', combinedInfo.daily.isLimitReached);
    console.log('  - Lifetime limit reached:', combinedInfo.lifetime.isLimitReached);
    console.log('  - Daily count:', combinedInfo.daily.count);
    console.log('  - Daily limit:', combinedInfo.daily.limit);
    console.log('  - Lifetime remaining:', combinedInfo.lifetime.remainingQuestions);
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testLifetimeTracking(); 