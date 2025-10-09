n8n Gmail integration example (fetch credentials from Supabase and call Gmail API)

1) Supabase node (Postgres or HTTP)
- Use the Supabase HTTP API or Postgres node to fetch credentials for the current user_id.
- Example SQL (Postgres node):

  SELECT gmail_client_id, gmail_client_secret, gmail_access_token, gmail_refresh_token, token_expiry
  FROM user_credentials
  WHERE user_id = '{{ $json["user_id"] }}';

- The node's output will include the stored refresh_token.

2) HTTP Request node: Exchange refresh_token for a fresh access token (if expired)
- Method: POST
- URL: https://oauth2.googleapis.com/token
- Authentication: none
- Headers:
  Content-Type: application/x-www-form-urlencoded
- Body (raw / form-encoded):
  client_id={{ $json["gmail_client_id"] }}
  client_secret={{ $json["gmail_client_secret"] }}
  refresh_token={{ $json["gmail_refresh_token"] }}
  grant_type=refresh_token

- Parse JSON output: you'll get access_token and expires_in.

3) HTTP Request node: Call Gmail API (e.g., send message)
- Method: POST
- URL: https://gmail.googleapis.com/gmail/v1/users/me/messages/send
- Headers:
  Authorization: Bearer {{$json["access_token"]}}
  Content-Type: application/json
- Body: (use Gmail API message format with base64-encoded RFC 2822 message)

4) Optional: Persist new access_token and expiry back to Supabase
- If you received a new access_token and expires_in, optionally update user_credentials with new token_expiry and access_token (so future flows can reuse it until expiry).

Notes
- Never store raw client_secret or refresh_token in public logs. Keep Supabase row permissioned so only server or n8n can read credentials.
- Use a server-side helper (or n8n credentials) to rotate tokens securely if possible.
