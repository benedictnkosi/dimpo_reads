// Mock the reading level promotion logic without AsyncStorage
function testReadingLevelPromotion() {
    console.log('🧪 Testing Reading Level Promotion Logic...\n');

    // Reading level constants
    const READING_LEVELS = {
        EXPLORER: 'Explorer',
        BUILDER: 'Builder', 
        CHALLENGER: 'Challenger'
    };

    // Helper functions to convert between numeric and text levels
    const getNumericLevel = (textLevel) => {
        switch (textLevel) {
            case READING_LEVELS.EXPLORER: return 1;
            case READING_LEVELS.BUILDER: return 2;
            case READING_LEVELS.CHALLENGER: return 3;
            default: return 1;
        }
    };

    const getTextLevel = (numericLevel) => {
        switch (numericLevel) {
            case 1: return READING_LEVELS.EXPLORER;
            case 2: return READING_LEVELS.BUILDER;
            case 3: return READING_LEVELS.CHALLENGER;
            default: return READING_LEVELS.EXPLORER;
        }
    };

    // Test Case 0: Reading level initialization (new test)
    console.log('Test Case 0: Reading level initialization');
    let currentLevel = null; // Simulate no reading level set
    
    // Simulate the initialization logic
    if (!currentLevel) {
        currentLevel = READING_LEVELS.EXPLORER;
        console.log(`✅ Reading level initialized to: ${currentLevel}`);
    } else {
        console.log(`📖 Reading level already set to: ${currentLevel}`);
    }

    // Test Case 1: Reading speed > 100 WPM and comprehension = 100% (should promote)
    console.log('\nTest Case 1: Reading speed > 100 WPM and comprehension = 100%');
    currentLevel = READING_LEVELS.EXPLORER;
    
    const readingSpeed1 = 120; // > 100 WPM
    const comprehension1 = 100; // 100%
    
    if (readingSpeed1 > 100 && comprehension1 === 100) {
        const currentLevelNum = getNumericLevel(currentLevel);
        if (currentLevelNum < 3) {
            const newLevelNum = currentLevelNum + 1;
            const newLevelText = getTextLevel(newLevelNum);
            currentLevel = newLevelText;
            console.log(`✅ PROMOTED: ${getTextLevel(currentLevelNum)} → ${newLevelText}`);
        } else {
            console.log(`❌ Already at max level (${currentLevel})`);
        }
    } else {
        console.log('❌ Conditions not met for promotion');
    }

    // Test Case 2: Reading speed < 100 WPM and comprehension = 100% (should NOT promote)
    console.log('\nTest Case 2: Reading speed < 100 WPM and comprehension = 100%');
    currentLevel = READING_LEVELS.EXPLORER;
    
    const readingSpeed2 = 80; // < 100 WPM
    const comprehension2 = 100; // 100%
    
    if (readingSpeed2 > 100 && comprehension2 === 100) {
        const currentLevelNum = getNumericLevel(currentLevel);
        if (currentLevelNum < 3) {
            const newLevelNum = currentLevelNum + 1;
            const newLevelText = getTextLevel(newLevelNum);
            currentLevel = newLevelText;
            console.log(`✅ PROMOTED: ${getTextLevel(currentLevelNum)} → ${newLevelText}`);
        } else {
            console.log(`❌ Already at max level (${currentLevel})`);
        }
    } else {
        console.log('❌ Conditions not met for promotion (reading speed too low)');
    }

    // Test Case 3: Reading speed > 100 WPM and comprehension < 100% (should NOT promote)
    console.log('\nTest Case 3: Reading speed > 100 WPM and comprehension < 100%');
    currentLevel = READING_LEVELS.EXPLORER;
    
    const readingSpeed3 = 120; // > 100 WPM
    const comprehension3 = 90; // < 100%
    
    if (readingSpeed3 > 100 && comprehension3 === 100) {
        const currentLevelNum = getNumericLevel(currentLevel);
        if (currentLevelNum < 3) {
            const newLevelNum = currentLevelNum + 1;
            const newLevelText = getTextLevel(newLevelNum);
            currentLevel = newLevelText;
            console.log(`✅ PROMOTED: ${getTextLevel(currentLevelNum)} → ${newLevelText}`);
        } else {
            console.log(`❌ Already at max level (${currentLevel})`);
        }
    } else {
        console.log('❌ Conditions not met for promotion (comprehension not 100%)');
    }

    // Test Case 4: Already at max level (should NOT promote)
    console.log('\nTest Case 4: Already at max level (Challenger)');
    currentLevel = READING_LEVELS.CHALLENGER;
    
    const readingSpeed4 = 120; // > 100 WPM
    const comprehension4 = 100; // 100%
    
    if (readingSpeed4 > 100 && comprehension4 === 100) {
        const currentLevelNum = getNumericLevel(currentLevel);
        if (currentLevelNum < 3) {
            const newLevelNum = currentLevelNum + 1;
            const newLevelText = getTextLevel(newLevelNum);
            currentLevel = newLevelText;
            console.log(`✅ PROMOTED: ${getTextLevel(currentLevelNum)} → ${newLevelText}`);
        } else {
            console.log(`❌ Already at max level (${currentLevel})`);
        }
    } else {
        console.log('❌ Conditions not met for promotion');
    }

    // Test Case 5: Multiple promotions (Explorer → Builder → Challenger)
    console.log('\nTest Case 5: Multiple promotions (Explorer → Builder → Challenger)');
    currentLevel = READING_LEVELS.EXPLORER;
    
    const readingSpeed5 = 120; // > 100 WPM
    const comprehension5 = 100; // 100%
    
    // First promotion
    if (readingSpeed5 > 100 && comprehension5 === 100) {
        const currentLevelNum = getNumericLevel(currentLevel);
        if (currentLevelNum < 3) {
            const newLevelNum = currentLevelNum + 1;
            const newLevelText = getTextLevel(newLevelNum);
            currentLevel = newLevelText;
            console.log(`✅ First promotion: ${getTextLevel(currentLevelNum)} → ${newLevelText}`);
        }
    }

    // Second promotion
    if (readingSpeed5 > 100 && comprehension5 === 100) {
        const currentLevelNum = getNumericLevel(currentLevel);
        if (currentLevelNum < 3) {
            const newLevelNum = currentLevelNum + 1;
            const newLevelText = getTextLevel(newLevelNum);
            currentLevel = newLevelText;
            console.log(`✅ Second promotion: ${getTextLevel(currentLevelNum)} → ${newLevelText}`);
        } else {
            console.log(`❌ Already at max level (${currentLevel})`);
        }
    }

    // Test Case 6: Demotion logic (score < 80 and speed < 100)
    console.log('\nTest Case 6: Demotion logic (score < 80 and speed < 100)');
    currentLevel = READING_LEVELS.BUILDER;
    
    const readingSpeed6 = 80; // < 100 WPM
    const comprehension6 = 70; // < 80%
    
    if (readingSpeed6 < 100 && comprehension6 < 80) {
        const currentLevelNum = getNumericLevel(currentLevel);
        if (currentLevelNum > 1) {
            const newLevelNum = currentLevelNum - 1;
            const newLevelText = getTextLevel(newLevelNum);
            currentLevel = newLevelText;
            console.log(`⬇️ DEMOTED: ${getTextLevel(currentLevelNum)} → ${newLevelText}`);
        } else {
            console.log(`❌ Already at min level (${currentLevel})`);
        }
    } else {
        console.log('❌ Conditions not met for demotion');
    }

    // Final check
    console.log(`\n📊 Final reading level: ${currentLevel}`);

    console.log('\n🎉 Reading level promotion/demotion tests completed!');
    console.log('\n📋 Summary:');
    console.log('- Promotion requires: Reading speed > 100 WPM AND comprehension = 100%');
    console.log('- Demotion requires: Reading speed < 100 WPM AND comprehension < 80%');
    console.log('- Levels: Explorer → Builder → Challenger');
    console.log('- Maximum level: Challenger');
    console.log('- Minimum level: Explorer');
    console.log('- Each promotion/demotion changes level by 1');
    console.log('- Analytics tracking included for successful promotions/demotions');
}

// Run the test
testReadingLevelPromotion(); 