# Nextlog Tests

This directory contains Playwright end-to-end tests for the Nextlog amateur radio logging application.

## Test Structure

- `basic-navigation.spec.ts` - Basic page loading and navigation tests
- `core-features.spec.ts` - Core application functionality tests (responsiveness, CSS, error handling)
- `authentication.spec.ts` - Login and registration page tests
- `homepage.spec.ts` - Homepage and redirect behavior tests
- `contact-management.spec.ts` - Contact management page tests
- `features.spec.ts` - Additional feature page tests (ADIF, LoTW, Awards, etc.)

## Running Tests

```bash
# Run all tests
npm test

# Run tests for a specific browser
npm run test:chromium

# Run specific test file
npm run test:chromium tests/basic-navigation.spec.ts

# Run tests in headed mode (visible browser)
npm run test:headed

# Run tests in UI mode
npm run test:ui

# Debug tests
npm run test:debug
```

## Test Philosophy

These tests are designed to work with Nextlog's installation flow:

1. **Without Database**: When no PostgreSQL database is connected, the application redirects to `/install`. Tests verify this behavior and ensure pages load correctly.

2. **Page Structure**: Tests verify that forms, buttons, and key UI elements are present and accessible.

3. **Error Handling**: Tests ensure the application handles database connection errors gracefully without server crashes.

4. **Responsive Design**: Tests verify the application works across different viewport sizes.

## CI/CD Integration

Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

The GitHub Actions workflow installs dependencies, builds the application, and runs the complete test suite.

## Adding New Tests

When adding new features to Nextlog:

1. Create test files following the naming convention `feature-name.spec.ts`
2. Test both authenticated and unauthenticated states
3. Verify form validation and error handling
4. Test responsive behavior on different screen sizes
5. Ensure tests work without requiring a database connection

## Test Configuration

See `playwright.config.ts` for:
- Browser configuration
- Test timeouts
- Web server setup
- Reporter settings