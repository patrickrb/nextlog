# Branch Protection Setup

To require passing tests before merging pull requests, configure branch protection rules:

## GitHub Repository Settings

1. Go to **Settings** → **Branches**
2. Click **Add rule** or edit existing rule for `main` branch
3. Configure the following settings:

### Required Settings
- ✅ **Require a pull request before merging**
- ✅ **Require status checks to pass before merging**
- ✅ **Require branches to be up to date before merging**

### Required Status Checks
Add these status checks:
- `test` (from CI workflow)
- `tests-required` (from CI workflow)

### Recommended Settings
- ✅ **Restrict pushes that create files larger than 100 MB**
- ✅ **Require conversation resolution before merging**
- ✅ **Do not allow bypassing the above settings**

## Alternative: Using GitHub CLI

```bash
# Enable branch protection with required tests
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"checks":[{"context":"test"},{"context":"tests-required"}]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1}' \
  --field restrictions=null
```

## Verification

Once configured:
1. All pull requests will require passing tests
2. Direct pushes to main branch will be blocked
3. Tests must pass before merging is allowed
4. The "tests-required" job ensures test completion

This ensures code quality and prevents breaking changes from being merged into the main branch.