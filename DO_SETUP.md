# DigitalOcean App Platform Full-Stack Deployment Guide

This guide covers deploying the complete endless-gaming application (frontend + backend + data collection) to DigitalOcean App Platform using `doctl` and app specifications.

## Overview

DigitalOcean App Platform provides a serverless platform-as-a-service that automatically scales your application and manages databases. This setup deploys the complete gaming platform with:

- **Angular Frontend** - Static site with SPA routing
- **Flask API Backend** - Web service for game data API
- **Automated PostgreSQL database** - Managed database with backups
- **Scheduled data collection** - Daily cron jobs for automated data updates
- **Git-based deployments** - Auto-deploy from GitHub on push
- **Environment management** - Separate staging/production environments
- **Integrated routing** - `/api/*` routes to backend, `/*` routes to frontend

## Application Architecture

The deployment consists of multiple services working together:

### Frontend (Angular Static Site)
- **Technology**: Angular 20.1.0 with standalone components
- **Deployment**: Static site service with SPA routing
- **Build Process**: Node.js with custom build script
- **Routes**: Serves all routes except `/api/*`
- **Features**: Client-side routing, IndexedDB caching, ML algorithms

### Backend (Flask Web Service)
- **Technology**: Flask 3.1.1 with application factory pattern
- **Deployment**: Web service with health checks
- **Routes**: Serves `/api/discovery/*` endpoints (mapped from `/discovery/*`)
- **Features**: Game data API, database connectivity, CORS configuration

### Database & Jobs
- **Database**: Managed PostgreSQL with automated backups
- **Data Collection**: Scheduled CRON jobs for Steam/SteamSpy data
- **Frequency**: Daily collection (15-30k games depending on environment)

## Build Process

DigitalOcean App Platform builds your application using **Cloud Native Buildpacks**:

### Backend Build (Python)
1. **Detects Python** from `pyproject.toml` and `poetry.lock`
2. **Installs Poetry** via the build command in app spec
3. **Installs dependencies** using `poetry install --only=main`
4. **Installs Gunicorn** for production WSGI server
5. **Creates optimized image** for production deployment

### Frontend Build (Node.js)
1. **Detects Node.js** from `package.json` and `package-lock.json`
2. **Runs custom build script** with error checking and validation
3. **Installs dependencies** using `npm ci`
4. **Builds Angular app** with production configuration
5. **Generates static assets** in `/dist` directory

This means your `Dockerfile` is ignored - the platform handles containerization automatically.

## Routing & API Integration

The deployment uses DigitalOcean App Platform's built-in routing to handle frontend/backend integration:

### Request Routing
```
User Request Flow:
├── Frontend Routes (/*) → Angular Static Site
│   ├── /game-picker → Angular SPA
│   ├── /recommendations → Angular SPA  
│   └── /* → Angular SPA (client-side routing)
│
└── API Routes (/api/*) → Flask Backend Service
    ├── /api/discovery/games/master.json → Flask /discovery/games/master.json
    └── /api/health → Flask /health
```

### Path Rewriting
- **Frontend**: Calls `/api/discovery/games/master.json`
- **DO Platform**: Routes `/api/*` to Flask service
- **Path Rewriting**: `/api/discovery/*` → Flask `/discovery/*`
- **Backend**: Handles `/discovery/games/master.json`

### CORS Configuration
- **Development**: `CORS_ORIGINS="*"` (accepts all origins)
- **Production**: `CORS_ORIGINS="https://YOUR_DOMAIN.com"` (specific domain)
- **Headers**: Automatic handling of preflight requests

### Health Checks
- **Endpoint**: `/health` on Flask backend service
- **Monitoring**: Database connectivity + application status
- **Frequency**: Every 10 seconds with failure thresholds

## Prerequisites

### 1. DigitalOcean Account Setup

You'll need a DigitalOcean account with:
- Active billing method configured
- API access enabled

### 2. GitHub Repository Access

Ensure you have:
- Owner or Maintainer permissions on the GitHub repository
- Repository pushed to GitHub (the one we just created)

### 3. Required Tools

Install the DigitalOcean CLI:

```bash
# macOS
brew install doctl

# Linux
cd ~
wget https://github.com/digitalocean/doctl/releases/download/v1.104.0/doctl-1.104.0-linux-amd64.tar.gz
tar xf doctl-1.104.0-linux-amd64.tar.gz
sudo mv doctl /usr/local/bin

# Windows
# Download from: https://github.com/digitalocean/doctl/releases
```

## Manual Setup Steps (One-Time)

### 1. Create DigitalOcean API Token

1. Log into [DigitalOcean Control Panel](https://cloud.digitalocean.com/)
2. Navigate to **API** → **Personal Access Tokens**
3. Click **Generate New Token**
4. Name: `endless-gaming-deployment`
5. Scopes: **Read** and **Write**
6. Copy the token (you won't see it again)

### 2. Authenticate doctl

```bash
doctl auth init --access-token YOUR_API_TOKEN
```

Verify authentication:
```bash
doctl account get
```

### 3. Connect GitHub to DigitalOcean (One-Time)

This step requires using the DigitalOcean control panel:

1. Go to [App Platform](https://cloud.digitalocean.com/apps)
2. Click **Create App**
3. Choose **GitHub** as source
4. Click **Authorize DigitalOcean** and complete OAuth flow
5. **Cancel app creation** (we'll do this via CLI)

Once connected, DigitalOcean can access your GitHub repositories.

## App Configuration

### App Specification File

The `.do/app.yaml` file defines your entire application infrastructure. Here's what it configures:

- **Scheduled cron jobs** for automated data collection
- **PostgreSQL database** for storing game data
- **Environment variables** for configuration
- **Auto-deployment** from GitHub
- **Pre-deploy database setup** jobs

### Scheduled Data Collection

The app uses **cron jobs** instead of long-running services:

**Development (app.yaml):**
- `daily-data-collection`: Runs at 6 AM UTC daily, collects 15 pages (~15,000 games)
- `database-setup`: Runs before each deployment to ensure DB is ready

**Production (app-production.yaml):**
- `daily-full-collection`: Runs at 2 AM UTC daily, collects 30 pages (~30,000 games)
- `weekly-maintenance`: Runs weekly to check database status
- `database-setup`: Pre-deploy database initialization

This approach is more cost-effective than running 24/7 services.

### Environment Variables

The app automatically configures:
- `DATABASE_URL` - PostgreSQL connection string
- `PYTHONPATH` - Python module path
- `POETRY_VENV_IN_PROJECT` - Poetry configuration

You can add custom variables by editing the app spec.

## Deployment Commands

### Create the Application

```bash
# Create app from specification
doctl apps create --spec .do/app.yaml

# Check deployment status
doctl apps list

# Get app details
doctl apps get <APP_ID>
```

### Monitor Deployment

```bash
# View deployment logs
doctl apps logs <APP_ID> --type deploy

# View runtime logs
doctl apps logs <APP_ID> --type run

# Follow logs in real-time
doctl apps logs <APP_ID> --follow
```

### Manage the Application

```bash
# Update app configuration
doctl apps update <APP_ID> --spec .do/app.yaml

# Restart the application
doctl apps create-deployment <APP_ID>

# Delete the application
doctl apps delete <APP_ID>
```

## Database Management

### Access Database Information

```bash
# List databases
doctl databases list

# Get connection details
doctl databases connection <DATABASE_ID>

# Create database backup
doctl databases backups list <DATABASE_ID>
```

### Connect to Database

```bash
# Get connection string
doctl apps get <APP_ID> --format Spec.Databases

# Connect via psql (if available)
psql "postgresql://username:password@host:port/database"
```

## Environment Management

### Multiple Environments

Create separate apps for staging and production:

```bash
# Staging environment
doctl apps create --spec .do/app-staging.yaml

# Production environment  
doctl apps create --spec .do/app-production.yaml
```

### Environment Variables

Update environment variables without redeployment:

```bash
# Update app spec with new variables
doctl apps update <APP_ID> --spec .do/app.yaml
```

## Managing Scheduled Jobs

### Monitor Cron Jobs

```bash
# List all jobs for your app
doctl apps list-deployments <APP_ID>

# View cron job logs
doctl apps logs <APP_ID> --type job

# Check specific job logs
doctl apps logs <APP_ID> --type job --deployment <DEPLOYMENT_ID>
```

### Manual Data Collection

Trigger one-off data collection manually:

```bash
# Create a manual job (requires app spec modification)
doctl apps update <APP_ID> --spec .do/app.yaml

# Monitor the job execution
doctl apps logs <APP_ID> --type job --follow
```

### Cron Schedule Examples

```bash
# Every day at 6 AM UTC
schedule: "0 6 * * *"

# Every 12 hours
schedule: "0 */12 * * *"

# Every Sunday at 1 AM UTC
schedule: "0 1 * * 0"

# Every hour (not recommended for rate-limited APIs)
schedule: "0 * * * *"
```

## Cost Optimization

### Development Setup

For development/testing, use minimal resources:

```yaml
instance_size_slug: basic-xxs
instance_count: 1
databases:
  - size: db-s-dev-database
```

### Production Setup

For production, use appropriate sizing:

```yaml
instance_size_slug: basic-xs
instance_count: 1
databases:
  - size: db-s-1vcpu-1gb
```

### Auto-Scaling

App Platform can auto-scale based on:
- CPU usage
- Memory usage  
- Request volume

Configure in the app spec:
```yaml
autoscaling:
  min_instance_count: 1
  max_instance_count: 3
```

## Monitoring and Debugging

### Application Metrics

Monitor your app via:
1. **DigitalOcean Control Panel** - Built-in metrics
2. **Application logs** - Via doctl or control panel
3. **Database metrics** - Query performance and usage

### Common Issues

**Deployment Failures:**
```bash
# Check deployment logs
doctl apps logs <APP_ID> --type deploy

# Verify app spec syntax
doctl apps validate-spec .do/app.yaml
```

**Runtime Errors:**
```bash
# Check application logs
doctl apps logs <APP_ID> --type run --follow

# Verify environment variables
doctl apps get <APP_ID> --format Spec.Services
```

**Database Connection Issues:**
```bash
# Check database status
doctl databases get <DATABASE_ID>

# Verify database configuration
doctl apps get <APP_ID> --format Spec.Databases
```

### Troubleshooting Commands

```bash
# Validate app specification
doctl apps validate-spec .do/app.yaml

# Get detailed app information
doctl apps get <APP_ID> --format json

# Check service health
doctl apps get <APP_ID> --format Spec.Services[0].Health

# View deployment history
doctl apps list-deployments <APP_ID>
```

## Security Considerations

### API Token Security

- Store API tokens securely (use environment variables)
- Rotate tokens regularly
- Use separate tokens for different environments

### Database Security

- Database is automatically secured within DigitalOcean's VPC
- Access limited to your application by default
- Regular security updates managed by DigitalOcean

### Environment Variables

- Sensitive data (API keys, etc.) stored as environment variables
- Never commit secrets to git
- Use DigitalOcean's secure environment variable storage

## Advanced Configuration

### Custom Domains

Add custom domains via app spec:

```yaml
domains:
  - domain: your-domain.com
    type: PRIMARY
```

### SSL Certificates

SSL is automatically managed by DigitalOcean App Platform.

### Health Checks

Configure health checks:

```yaml
health_check:
  http_path: /health
  initial_delay_seconds: 30
  period_seconds: 10
```

## Next Steps

After successful deployment:

1. **Monitor initial data collection** - Check logs for successful API calls
2. **Set up alerting** - Configure notifications for failures
3. **Optimize performance** - Adjust instance sizes based on usage
4. **Implement CI/CD** - Automate deployments via GitHub Actions
5. **Scale as needed** - Increase resources for larger datasets

## Support and Resources

- [DigitalOcean App Platform Documentation](https://docs.digitalocean.com/products/app-platform/)
- [doctl CLI Reference](https://docs.digitalocean.com/reference/doctl/)
- [App Specification Reference](https://docs.digitalocean.com/products/app-platform/reference/app-spec/)
- [Community Support](https://www.digitalocean.com/community/questions)