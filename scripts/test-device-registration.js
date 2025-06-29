const { getDeviceId, checkDeviceRegistration } = require('../services/deviceRegistration');

/**
 * Test device registration functionality
 * This script can be run to test the device registration endpoint
 */

async function testDeviceRegistration() {
  try {
    console.log('Testing device registration...');
    
    // Get device ID
    const deviceId = await getDeviceId();
    console.log('Device ID:', deviceId);
    
    // Check if device is registered
    const deviceInfo = await checkDeviceRegistration(deviceId);
    
    if (deviceInfo) {
      console.log('Device is already registered:');
      console.log('- ID:', deviceInfo.id);
      console.log('- Device ID:', deviceInfo.deviceId);
      console.log('- Learner UID:', deviceInfo.learnerUid);
      console.log('- Learner Email:', deviceInfo.learnerEmail);
      console.log('- Registration Date:', deviceInfo.registrationDate);
    } else {
      console.log('Device is not registered');
    }
    
  } catch (error) {
    console.error('Error testing device registration:', error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testDeviceRegistration()
    .then(success => {
      console.log(success ? '🎉 Test passed!' : '💥 Test failed!');
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test crashed:', error);
      process.exit(1);
    });
}

module.exports = { testDeviceRegistration }; 