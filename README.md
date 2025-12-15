# tw-wallet-back

Work is in progress...

Dev is progress...!
  

`npm start`

## Docker

Build the image:

```bash
docker build -t wallet-backend .
```

Run the container (mount your environment variables or use `--env-file`):

```bash
docker run --env-file .env -p 8083:8083 wallet-backend
```

Key environment variables commonly used by the service:

- `PORT` (default `8083`)
- `HOST` (default `0.0.0.0`)
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `ADMIN_EMAIL`

Check health once running:

```bash
curl http://localhost:8083/health
```
  