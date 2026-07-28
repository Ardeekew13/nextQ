# Security Implementation Guide

This document outlines the security features implemented in pickleq-app and instructions for production deployment.

## Security Features Implemented

### ✅ Authentication & Sessions
- **JWT Tokens**: 1-day TTL (not 30 days) - shorter-lived tokens reduce exposure if compromised
- **HTTP-Only Cookies**: Prevents XSS attacks from accessing auth tokens
- **Secure Cookie Flags**: 
  - `secure=true` in production (HTTPS only)
  - `sameSite=strict` prevents CSRF
  - `httpOnly=true` prevents JavaScript access

### ✅ Password Policy
- Minimum 12 characters (up from 8)
- Must contain uppercase letters, numbers, and special characters (!@#$%^&*)
- Passwords hashed with bcryptjs (10 rounds)

### ✅ GraphQL Security
- **Introspection Disabled** in production (prevents schema discovery)
- **Query Depth Limits**: Maximum 10 levels deep (prevents DoS attacks)
- **No Stack Traces** in production (prevents information leakage)

### ✅ CSRF Protection
- CSRF tokens generated on authentication
- Token stored in secure, httpOnly cookie
- Clients receive token for mutation headers

### ✅ Rate Limiting
- 100 requests per minute per IP address
- Prevents brute force and DoS attacks
- Applied to all endpoints via middleware

### ✅ Security Headers
- **Content-Security-Policy**: Restricts resource loading
- **X-Frame-Options**: Prevents clickjacking (DENY)
- **X-Content-Type-Options**: Prevents MIME type sniffing (nosniff)
- **X-XSS-Protection**: Browser XSS filter (1; mode=block)
- **Referrer-Policy**: Controls referrer information
- **HSTS**: Enforces HTTPS (production only)
- **Permissions-Policy**: Disables unnecessary APIs

### ✅ Input Validation
- Email format validation
- Name length limits (max 100 chars)
- Password complexity requirements
- GraphQL query depth validation

### ✅ Dependency Security
- All npm vulnerabilities patched
- Regular dependency updates recommended
- Run `npm audit` before deployments

## Production Deployment Checklist

### 1. Environment Variables (CRITICAL)
Before deploying, you MUST:

```bash
# Generate a new JWT secret (DO NOT reuse the one in .env.local)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Output example: 3a7f9c2e5d8b1a4f6c9e2b3a5d8e1f4a7c9e2b3a5d8e1f4a7c9e2b3a5d8e

# Set these in your production environment:
JWT_SECRET=<generated-value>
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/pickleq?retryWrites=true&w=majority
AUTH_COOKIE_NAME=pickleq_session
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
NODE_ENV=production
```

### 2. Rotate MongoDB Credentials

If you're using the credentials from `.env.local`, they are now exposed:

1. Go to MongoDB Atlas
2. Create new database user with strong password
3. Update `MONGODB_URI` with new credentials
4. Delete or disable the old user account
5. Verify connection works

### 3. Update HTTPS and Domain Configuration

```bash
# Ensure your deployment uses HTTPS
# Update NEXT_PUBLIC_APP_URL to your production domain (https://...)
# The app will enforce secure cookies only in production (NODE_ENV=production)
```

### 4. Cookie Configuration

The app automatically sets:
- `secure=true` (HTTPS only) when NODE_ENV=production
- `sameSite=strict` (prevents cross-site requests)
- `httpOnly=true` (prevents JavaScript access)

### 5. GraphQL Endpoint

- **Development**: Introspection enabled (schema explorer works)
- **Production**: Introspection disabled (schema not discoverable)
- Query depth limited to 10 levels to prevent DoS

### 6. Rate Limiting

- 100 requests/minute per IP address
- Applies to all endpoints
- Monitor logs for brute force attempts

### 7. Testing Before Production

```bash
# Run tests
npm test

# Check for vulnerabilities
npm audit

# Build and test locally
npm run build
npm run start
```

### 8. Monitoring & Maintenance

Post-deployment:
- Monitor for 429 (rate limit) errors in logs
- Check for failed login attempts
- Review GraphQL query patterns for optimization
- Update dependencies monthly
- Rotate JWT_SECRET every 90 days (invalidates all sessions)

## Security Best Practices

### For Developers

1. **Never commit `.env.local`** - it's in `.gitignore`
2. **Keep dependencies updated** - run `npm audit fix` regularly
3. **Validate all inputs** - especially GraphQL mutations
4. **Use HTTPS** - never test with HTTP in production mode
5. **Check security headers** - use https://securityheaders.com

### For Operators

1. **Secure your hosting platform**:
   - Enable DDoS protection
   - Use strong admin passwords
   - Enable 2FA on all accounts
   - Restrict SSH/RDP access

2. **Monitor logs**:
   - 429 errors = rate limit hits (investigate spikes)
   - Login failures = brute force attempts
   - GraphQL errors = query issues

3. **Backup MongoDB**:
   - Enable automatic backups
   - Test restore procedures
   - Keep backups off-site

4. **Update regularly**:
   - Node.js security patches
   - npm dependency updates
   - OS security updates

## Known Limitations

- Rate limiting is in-memory (resets on server restart)
- For production scaling, consider:
  - Redis for distributed rate limiting
  - WAF (Web Application Firewall) for additional DDoS protection
  - CDN with security rules

## Incident Response

If you suspect a security breach:

1. **Rotate credentials immediately**:
   - JWT_SECRET (invalidates all sessions)
   - MongoDB credentials

2. **Check logs for**:
   - Unusual login attempts
   - Data access patterns
   - API usage spikes

3. **Notify users**:
   - If user data is compromised
   - Require password reset

4. **Review audit logs**:
   - Database access logs
   - API request logs

## Additional Resources

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Next.js Security: https://nextjs.org/docs/advanced-features/security-headers
- Apollo Security: https://www.apollographql.com/docs/apollo-server/security/authentication/
- MongoDB Security: https://docs.mongodb.com/manual/security/

## Questions?

Review the implementation in:
- `src/lib/auth.ts` - JWT and password hashing
- `src/lib/csrf.ts` - CSRF token generation
- `src/middleware.ts` - Rate limiting and security headers
- `src/graphql/server.ts` - GraphQL configuration
- `next.config.mjs` - Next.js security headers
