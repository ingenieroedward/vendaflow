// Setup global de Jest — se ejecuta antes de cada suite
process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] = process.env['JWT_SECRET'] || 'test-secret';
