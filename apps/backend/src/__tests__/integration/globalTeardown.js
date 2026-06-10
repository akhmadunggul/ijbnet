'use strict';
// The test DB is kept between runs so failed tests can be inspected.
// Tables are truncated by beforeEach in each test file.
module.exports = async function globalTeardown() {
  // nothing — DB preserved for debugging
};
