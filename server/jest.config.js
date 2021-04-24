// (to convert this file to ts, would need to add ts-node)

module.exports = {
  // Use ts-jest for TypeScript transpilation
  preset: 'ts-jest',

  // Automatically clear mock calls and instances between every test
  clearMocks: true,

  // Automatically reset mock state between every test
  // resetMocks: false,

  // The test environment that will be used for testing
  testEnvironment: "node",
};
