# Production Deployment Checklist

Use this checklist before deploying to production.

## Pre-Deployment (Before Code Deployment)

### Credentials & Secrets
- [ ] Rotate MongoDB Atlas credentials
  - [ ] Create new database user
  - [ ] Note new password
  - [ ] Delete old user account
  - [ ] Test connection with new credentials
- [ ] Generate new JWT_SECRET
  - [ ] Run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
  - [ ] Store in secure secret manager (not in git)
  - [ ] Note: This will invalidate all existing user sessions
- [ ] Have NEXT_PUBLIC_APP_URL ready (your production domain with https://)

### Infrastructure Setup
- [ ] Hosting platform configured
- [ ] HTTPS/SSL certificate installed
- [ ] MongoDB Atlas cluster ready
- [ ] Database backups enabled and tested
- [ ] Email/alerts configured for monitoring

### Code Verification
- [ ] All npm vulnerabilities fixed
  ```bash
  npm audit
  ```
- [ ] TypeScript compiles without errors
  ```bash
  npx tsc --noEmit
  ```
- [ ] Tests pass (or reviewed known failures)
  ```bash
  npm test
  ```
- [ ] Code reviewed for security issues

## During Deployment

### Environment Configuration
- [ ] Set NODE_ENV=production
- [ ] Set JWT_SECRET (generated value)
- [ ] Set MONGODB_URI (with new credentials)
- [ ] Set AUTH_COOKIE_NAME=pickleq_session
- [ ] Set NEXT_PUBLIC_APP_URL=https://your-domain.com
- [ ] Verify no .env.local file in production
- [ ] Verify .gitignore includes .env.local

### Deployment Steps
- [ ] Build application
  ```bash
  npm run build
  ```
- [ ] Deploy to production platform
- [ ] Start application
  ```bash
  npm start
  ```
- [ ] Verify application is running
- [ ] Check logs for errors

### Security Headers Verification
- [ ] Visit https://securityheaders.com
- [ ] Enter your domain
- [ ] Verify all security headers are present:
  - [ ] Content-Security-Policy
  - [ ] X-Frame-Options: DENY
  - [ ] X-Content-Type-Options: nosniff
  - [ ] X-XSS-Protection
  - [ ] Referrer-Policy
  - [ ] Strict-Transport-Security (production only)

## Post-Deployment (First 24 Hours)

### Functionality Testing
- [ ] Can create new account
- [ ] Can login with new account
- [ ] Can create club
- [ ] Can create session
- [ ] Can add players
- [ ] Can log scores
- [ ] Can logout
- [ ] Session persists across page refresh

### Security Testing
- [ ] Login with weak password (should fail)
  - Less than 12 characters
  - No uppercase letter
  - No number
  - No special character
- [ ] Test rate limiting (open DevTools, make 150 requests in 1 min)
  - Should get 429 errors after 100 requests
- [ ] Clear cookies and login again (test CSRF token rotation)
- [ ] Inspect auth cookie:
  - [ ] httpOnly flag present
  - [ ] secure flag present (production)
  - [ ] sameSite=strict
- [ ] Check that GraphQL introspection is disabled
  ```graphql
  query IntrospectionQuery {
    __schema {
      types {
        name
      }
    }
  }
  ```
  Should fail with "Cannot query __schema" error

### Monitoring Setup
- [ ] Error logging configured
- [ ] Monitor for 429 (rate limit) errors
- [ ] Monitor for login failures
- [ ] Monitor for GraphQL errors
- [ ] Set up alerts for:
  - [ ] High error rate
  - [ ] Database connection issues
  - [ ] Server down
- [ ] Configure log retention (30+ days recommended)

### Documentation
- [ ] Team notified of production deployment
- [ ] Users notified if login required
- [ ] Runbook updated with new JWT_SECRET rotation schedule
- [ ] On-call team briefed on security features
- [ ] Incident response procedure reviewed

## Ongoing Maintenance

### Weekly
- [ ] Check logs for unusual activity
- [ ] Monitor uptime and performance
- [ ] Review error trends

### Monthly
- [ ] Run `npm audit` and apply fixes if available
- [ ] Review security logs
- [ ] Update password for any shared accounts
- [ ] Test backup and restore procedure

### Every 3 Months
- [ ] Review access logs
- [ ] Update Node.js if patch available
- [ ] Plan JWT_SECRET rotation (if needed)
- [ ] Review security best practices

### Annually
- [ ] Rotate all secrets (JWT_SECRET, DB credentials)
- [ ] Update dependencies to latest major versions
- [ ] Security audit/review
- [ ] Penetration testing (recommended)
- [ ] Disaster recovery drill

## Rollback Plan

If something goes wrong:

1. **Stop the deployment**:
   - Revert to previous version
   - Keep new JWT_SECRET and MongoDB credentials active

2. **Investigate**:
   - Check logs for errors
   - Test locally with same configuration

3. **Fix and redeploy**:
   - Fix issue locally
   - Test thoroughly
   - Redeploy to production

Note: Users cannot revert sessions to old JWT_SECRET, so once you deploy with a new secret, previous sessions are invalidated.

## Support Contacts

In case of issues:
- [ ] Hosting platform support number
- [ ] MongoDB support details
- [ ] On-call engineer contact
- [ ] Security contact email

## Sign-Off

- [ ] Deployment lead name: _____________
- [ ] Date deployed: _____________
- [ ] Time deployed: _____________
- [ ] Verified healthy at: _____________
