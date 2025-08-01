// Simple test script to check the install API
const testInstallCheck = async () => {
  try {
    console.log('Testing install check API...');
    const response = await fetch('http://localhost:3000/api/install/check');
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Response data:', JSON.stringify(data, null, 2));
    } else {
      const errorText = await response.text();
      console.log('Error response:', errorText);
    }
  } catch (error) {
    console.error('Fetch failed:', error);
  }
};

testInstallCheck();