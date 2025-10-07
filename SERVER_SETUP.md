Server startup with Firebase Admin

This project now requires Firebase Admin credentials to run the server because routes validate Firebase ID tokens.

Required environment variables (one of these must be set):

- FIREBASE_SERVICE_ACCOUNT_JSON  - the literal JSON string of the Firebase service account (dangerous to put in public places; use secrets in deploy).
  Example (PowerShell):
    $env:FIREBASE_SERVICE_ACCOUNT_JSON = (Get-Content -Raw -Path 'C:\path\to\serviceAccount.json')

- FIREBASE_ADMIN_CREDENTIALS_PATH - path to the JSON file containing the service account
  Example (PowerShell):
    $env:FIREBASE_ADMIN_CREDENTIALS_PATH = 'C:\path\to\serviceAccount.json'

Also required (already present earlier):
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

Start the dev server (PowerShell):

$env:SUPABASE_URL='https://...'; $env:SUPABASE_SERVICE_ROLE_KEY='service-role-key';
$env:FIREBASE_ADMIN_CREDENTIALS_PATH='C:\path\to\serviceAccount.json'; npm run dev

Security note: do NOT check service account JSON into source control. Use your CI/CD secret manager to inject the env variable at deploy time.
