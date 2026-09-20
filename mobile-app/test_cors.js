async function checkCors() {
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'OPTIONS',
    headers: {
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
      'Origin': 'https://smpithm.sch.id'
    }
  });
  console.log('Status:', response.status);
  console.log('Headers:');
  response.headers.forEach((value, key) => {
    console.log(key, value);
  });
}
checkCors();
