# Fix MySQL Connection Timeout in Kubernetes

## Problem
The backend is getting `ETIMEDOUT` errors when trying to connect to MySQL. This happens because:

1. **Wrong DB_HOST**: In Kubernetes, `localhost` won't work - you need the MySQL service name
2. **Network connectivity**: Pods might not be able to reach the database
3. **Missing environment variables**: Database credentials not set in K8s deployment

## Solution

### Step 1: Check Your MySQL Service Name in Kubernetes

```bash
# List all services in your namespace
kubectl get services -n <namespace>

# Look for MySQL service (might be named: mysql, mariadb, database, etc.)
kubectl get svc -n <namespace> | grep -i mysql
```

The service name is what you need to use as `DB_HOST`.

### Step 2: Update Your Kubernetes Deployment/ConfigMap/Secret

You need to set these environment variables in your K8s deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: trust-wallet-backend
  namespace: twwin-sports
spec:
  template:
    spec:
      containers:
      - name: trust-wallet-backend
        image: dev-harbor.newtwwin.com:30443/twwin-sports/trust-wallet-backend:1.6.5
        env:
          # ✅ CRITICAL: Use MySQL service name, not localhost!
          - name: DB_HOST
            value: "mysql-service"  # ← Replace with your actual MySQL service name
          
          - name: DB_USER
            valueFrom:
              secretKeyRef:
                name: mysql-credentials
                key: username
          # OR directly:
          # - name: DB_USER
          #   value: "app_user"
          
          - name: DB_PASSWORD
            valueFrom:
              secretKeyRef:
                name: mysql-credentials
                key: password
          # OR directly:
          # - name: DB_PASSWORD
          #   value: "your-password"
          
          - name: DB_NAME
            value: "wallet_db"
          
          - name: PORT
            value: "8083"
          
          - name: HOST
            value: "0.0.0.0"
```

### Step 3: Common MySQL Service Names

In Kubernetes, MySQL might be:
- Service name: `mysql`, `mariadb`, `database`, `db`, `mysql-service`
- Format: `<service-name>.<namespace>.svc.cluster.local` (full DNS)
- Or just: `<service-name>` (if in same namespace)

**Example:**
```yaml
# If MySQL service is named "mysql" in namespace "twwin-sports"
DB_HOST: "mysql"  # Same namespace
# OR
DB_HOST: "mysql.twwin-sports.svc.cluster.local"  # Full DNS
```

### Step 4: Verify MySQL Service Exists

```bash
# Check if MySQL service exists
kubectl get svc -n <namespace>

# Describe the service to see details
kubectl describe svc <mysql-service-name> -n <namespace>

# Check if MySQL pod is running
kubectl get pods -n <namespace> | grep -i mysql
```

### Step 5: Test Connection from Backend Pod

```bash
# Get into your backend pod
kubectl exec -it <backend-pod-name> -n <namespace> -- /bin/sh

# Test MySQL connection (if mysql-client is installed)
mysql -h <mysql-service-name> -u <db-user> -p<db-password> <db-name>

# Or test with Node.js
node -e "require('mysql2/promise').createConnection({host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME}).then(() => console.log('Connected!')).catch(e => console.error('Error:', e.message))"
```

### Step 6: Check Network Policies

If you have NetworkPolicies, make sure backend can reach MySQL:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-backend-to-mysql
  namespace: twwin-sports
spec:
  podSelector:
    matchLabels:
      app: trust-wallet-backend
  policyTypes:
  - Egress
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: mysql  # Or your MySQL pod label
    ports:
    - protocol: TCP
      port: 3306
```

## Quick Fix Checklist

- [ ] Find MySQL service name: `kubectl get svc -n <namespace>`
- [ ] Update `DB_HOST` in deployment to use service name (not `localhost`)
- [ ] Verify `DB_USER`, `DB_PASSWORD`, `DB_NAME` are set correctly
- [ ] Check MySQL pod is running: `kubectl get pods | grep mysql`
- [ ] Restart backend pod after updating env vars
- [ ] Check logs: `kubectl logs <backend-pod> -n <namespace>`

## Example: Complete Environment Variables

```yaml
env:
  - name: DB_HOST
    value: "mysql.twwin-sports.svc.cluster.local"  # Full DNS name
  - name: DB_USER
    value: "app_user"
  - name: DB_PASSWORD
    value: "your-secure-password"
  - name: DB_NAME
    value: "wallet_db"
  - name: PORT
    value: "8083"
  - name: HOST
    value: "0.0.0.0"
  - name: NODE_ENV
    value: "production"
```

## After Fixing

The code now includes:
- ✅ Connection retry logic (5 attempts with 3-second delays)
- ✅ Better error messages showing what to check
- ✅ Connection timeout settings (10 seconds)

After updating your K8s deployment with correct `DB_HOST`, restart the pod and check logs.

