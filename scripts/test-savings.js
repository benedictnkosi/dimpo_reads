const { initDatabase, getAllSavingsJugs, getSavingsStatistics, clearAllSavingsData } = require('../services/database');
const { initializeSavingsWithSampleData, addMoneyToJug, removeMoneyFromJug, getSavingsSummary } = require('../services/savingsService');

async function testSavings() {
  try {
    console.log('🧪 Testing Savings Functionality...\n');

    // Initialize database
    console.log('1. Initializing database...');
    initDatabase();
    console.log('✅ Database initialized\n');

    // Clear existing savings data
    console.log('2. Clearing existing savings data...');
    await clearAllSavingsData();
    console.log('✅ Savings data cleared\n');

    // Initialize savings with sample data
    console.log('3. Initializing savings with sample data...');
    await initializeSavingsWithSampleData();
    console.log('✅ Savings initialized with sample data\n');

    // Get all savings jars
    console.log('4. Getting all savings jars...');
    const allJugs = await getAllSavingsJugs();
    console.log(`📚 Total jugs: ${allJugs.length}\n`);

    // Display jugs
    console.log('5. Savings Jars:');
    allJugs.forEach((jug, index) => {
      console.log(`   ${index + 1}. ${jug.name}`);
      console.log(`      Balance: $${jug.balance.toFixed(2)}`);
      console.log(`      Created: ${jug.created}`);
      console.log(`      Updated: ${jug.updated}\n`);
    });

    // Get statistics
    console.log('6. Getting savings statistics...');
    const stats = await getSavingsStatistics();
    console.log('📊 Savings Statistics:');
    console.log(`   Total jugs: ${stats.total_jugs}`);
    console.log(`   Total balance: $${stats.total_balance.toFixed(2)}`);
    console.log(`   Total transactions: ${stats.total_transactions}`);
    console.log(`   Average balance: $${stats.average_balance.toFixed(2)}\n`);

    // Get savings summary
    console.log('7. Getting savings summary...');
    const summary = await getSavingsSummary();
    console.log('📋 Savings Summary:');
    console.log(`   Total balance: $${summary.totalBalance.toFixed(2)}`);
    console.log(`   Total jugs: ${summary.totalJugs}`);
    console.log(`   Total transactions: ${summary.totalTransactions}`);
    console.log(`   Average balance: $${summary.averageBalance.toFixed(2)}`);
    if (summary.topJug) {
      console.log(`   Top jug: ${summary.topJug.name} ($${summary.topJug.balance.toFixed(2)})`);
    }
    console.log('');

    // Test adding money to a jug
    if (allJugs.length > 0) {
      console.log('8. Testing add money functionality...');
      const jugId = allJugs[0].id;
      const jugName = allJugs[0].name;
      const initialBalance = allJugs[0].balance;
      
      await addMoneyToJug(jugId, 50, 'Test deposit');
      console.log(`✅ Added $50 to ${jugName}`);
      
      // Get updated jug
      const updatedJug = await getAllSavingsJugs();
      const jug = updatedJug.find(j => j.id === jugId);
      if (jug) {
        console.log(`   New balance: $${jug.balance.toFixed(2)} (was $${initialBalance.toFixed(2)})`);
      }
      console.log('');
    }

    // Test removing money from a jug
    if (allJugs.length > 0) {
      console.log('9. Testing remove money functionality...');
      const jugId = allJugs[0].id;
      const jugName = allJugs[0].name;
      
      // Get current balance
      const currentJugs = await getAllSavingsJugs();
      const jug = currentJugs.find(j => j.id === jugId);
      if (jug && jug.balance >= 25) {
        await removeMoneyFromJug(jugId, 25, 'Test withdrawal');
        console.log(`✅ Removed $25 from ${jugName}`);
        
        // Get updated jug
        const updatedJugs = await getAllSavingsJugs();
        const updatedJug = updatedJugs.find(j => j.id === jugId);
        if (updatedJug) {
          console.log(`   New balance: $${updatedJug.balance.toFixed(2)} (was $${jug.balance.toFixed(2)})`);
        }
      } else {
        console.log(`⚠️  Skipping withdrawal test - insufficient funds in ${jugName}`);
      }
      console.log('');
    }

    console.log('🎉 Savings test completed successfully!');

  } catch (error) {
    console.error('❌ Error during savings test:', error);
  }
}

// Run the test
testSavings(); 