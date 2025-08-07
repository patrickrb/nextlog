# Test Files Overview

## Test Categories

### Core Functionality
- `basic-navigation.spec.ts` - Basic page loading and URL routing ✅
- `core-features.spec.ts` - Responsive design, CSS loading, error handling ✅
- `build-performance.spec.ts` - Build validation and performance checks ✅

### Authentication & Security  
- `authentication.spec.ts` - Login/register forms and validation ✅
- `homepage.spec.ts` - Homepage redirects and installation flow ✅

### Application Features
- `contact-management.spec.ts` - Contact pages and dashboard ✅
- `features.spec.ts` - ADIF, LoTW, Awards, Stats, DXpeditions ✅
- `database-integration.spec.ts` - Database connection handling ✅

## Test Status

**All tests designed to work without database connection**
- Tests verify proper error handling when database unavailable
- Tests confirm pages load and redirect appropriately
- Tests validate form structure and accessibility
- Tests ensure responsive design across devices

## Coverage Areas

✅ **Navigation** - All major pages accessible  
✅ **Forms** - Login, registration, contact forms  
✅ **Error Handling** - Graceful database error handling  
✅ **Responsive Design** - Mobile, tablet, desktop layouts  
✅ **Accessibility** - Form labels, ARIA attributes, page structure  
✅ **Build Quality** - No JavaScript errors, CSS loading  
✅ **Security** - Authentication redirects, protected routes  

## Running Specific Test Categories

```bash
# Core functionality
npm run test:chromium tests/basic-navigation.spec.ts tests/core-features.spec.ts

# Authentication flows  
npm run test:chromium tests/authentication.spec.ts tests/homepage.spec.ts

# Feature coverage
npm run test:chromium tests/contact-management.spec.ts tests/features.spec.ts

# Database integration
npm run test:chromium tests/database-integration.spec.ts tests/build-performance.spec.ts
```