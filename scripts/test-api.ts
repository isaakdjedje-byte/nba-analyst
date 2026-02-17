/**
 * Test API Endpoint
 */

async function testAPI() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('Testing API...\n');
  
  try {
    // Test decisions endpoint
    const date = '2026-02-15';
    const response = await fetch(`${baseUrl}/api/v1/decisions?date=${date}`, {
      headers: {
        'Accept': 'application/json',
      },
    });
    
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    
    const data = await response.json();
    console.log('\nResponse:', JSON.stringify(data, null, 2));
    
    if (data.data) {
      console.log(`\n✅ Found ${data.data.length} decisions`);
    }
    
    if (data.error) {
      console.log(`\n❌ Error: ${data.error.message}`);
    }
    
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

testAPI();
