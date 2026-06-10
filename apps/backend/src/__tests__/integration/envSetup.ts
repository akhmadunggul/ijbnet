// These run before any module is imported in the test worker.
// config.ts only sets a key when it is NOT already in process.env,
// so these values take precedence over .env file contents.
process.env['NODE_ENV'] = 'test';
process.env['DB_NAME']  = 'ijbnet_test';
process.env['SMTP_HOST'] = ''; // email.ts already skips when SMTP_HOST is empty
