# DigitalOcean App Platform Frontend Configuration

This directory contains configuration files for deploying the Angular frontend to DigitalOcean App Platform.

## Files

### `build.sh`
Custom build script that:
- Verifies Node.js/NPM versions
- Runs clean install of dependencies
- Builds Angular app with production configuration
- Validates build output
- Provides detailed logging for debugging

## Deployment Configuration

The frontend is deployed as a **Static Site** service with:

### Build Process
- **Environment**: Node.js (latest)
- **Build Command**: Custom build script (`build.sh`)
- **Output Directory**: `/dist`
- **Source Directory**: `/endless-gaming-frontend`

### Routing Configuration
- **Primary Route**: `/` (catches all non-API routes)
- **SPA Fallback**: All unmatched routes serve `index.html`
- **Error Handling**: 404 errors serve `index.html` for client-side routing

### Integration with Backend
- **API Requests**: Frontend calls `/api/discovery/games/master.json`
- **Proxy Routing**: DO App Platform routes `/api/*` to Flask backend service
- **Path Rewriting**: `/api/discovery/*` → Flask `/discovery/*`

## Production Optimizations

### Build Optimizations
- Production configuration with minification
- Bundle optimization and tree-shaking
- Asset compression and caching headers
- Source map generation for debugging

### Performance Features
- Static asset caching
- CDN integration (built-in with DO)
- GZIP compression
- HTTP/2 support

## Environment Configuration

### Development (app.yaml)
- Smaller instance sizes
- Development-friendly logging
- CORS open to all origins

### Production (app-production.yaml)
- Optimized instance sizing
- Production logging levels
- Restricted CORS origins
- Enhanced error handling

## Troubleshooting

### Build Failures
1. Check Node.js version compatibility
2. Verify dependencies install successfully
3. Examine build script output
4. Validate Angular configuration

### Runtime Issues
1. Check static site routing configuration
2. Verify API endpoint connectivity
3. Examine CORS configuration
4. Test SPA fallback routing

### Common Issues
- **404 on Refresh**: Ensure `catchall_document: index.html` is set
- **API Errors**: Verify backend service is running and routing is correct
- **Build Timeouts**: Increase build timeout or optimize dependencies