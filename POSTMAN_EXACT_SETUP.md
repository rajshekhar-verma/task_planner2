# 🎯 EXACT POSTMAN SETUP

## The Issue
You're getting `{"code": 401, "message": "Missing authorization header"}` which means either:
1. Edge function is not deployed, OR
2. API key hash in database doesn't match

## Step 1: Check Edge Function Deployment

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `trhcrteklsoeoqrfsxlp`
3. Click **Edge Functions** in the left sidebar
4. Look for `third-party-api` function
5. If it's not there or shows "Not Deployed", click **Deploy**

## Step 2: Fix API Key Hash

Run this SQL in your Supabase SQL Editor:

```sql
-- Update API key hash to match your key
UPDATE api_keys 
SET key_hash = '4a44dc15364204a80fe80e9039455cc1608281820fe2b24f1e5233ade6af1dd5',
    is_active = true,
    expires_at = NULL
WHERE is_active = true;
```

## Step 3: Exact Postman Configuration

### Request Setup:
- **Method:** `GET`
- **URL:** `https://trhcrteklsoeoqrfsxlp.supabase.co/functions/v1/third-party-api`

### Headers Tab:
Add these two headers:

| Key | Value |
|-----|-------|
| `X-API-Key` | `tmp_QZ09tcj8g9k5Vf5TQ3vxhLUJWs48Rt2y` |
| `Content-Type` | `application/json` |

### Expected Responses:

#### ✅ Success (200):
```json
{
  "success": true,
  "data": [
    {
      "project_name": "Your Project",
      "project_id": "uuid-here",
      "project_status": "active",
      "tasks": [...]
    }
  ],
  "meta": {
    "total_projects": 1,
    "total_tasks": 5,
    "limit": 100,
    "offset": 0,
    "timestamp": "2025-01-07T..."
  }
}
```

#### ❌ Edge Function Not Deployed (404):
```
Cannot GET /functions/v1/third-party-api
```

#### ❌ API Key Hash Wrong (401):
```json
{"error":"Invalid or expired API key","code":"INVALID_API_KEY"}
```

#### ❌ Still Hitting REST API (401):
```json
{"code": 401, "message": "Missing authorization header"}
```

## Step 4: Test Command

Run this in terminal to verify:

```bash
curl -X GET \
  -H "X-API-Key: tmp_QZ09tcj8g9k5Vf5TQ3vxhLUJWs48Rt2y" \
  -H "Content-Type: application/json" \
  "https://trhcrteklsoeoqrfsxlp.supabase.co/functions/v1/third-party-api"
```

## Troubleshooting

### If you get 404:
- Edge function is not deployed
- Go to Supabase Dashboard → Edge Functions → Deploy `third-party-api`

### If you get "Missing authorization header":
- You're hitting the wrong endpoint
- Make sure URL has `/functions/v1/` not `/rest/v1/`

### If you get "Invalid or expired API key":
- Run the SQL update script above
- Or create a new API key in the dashboard

The most likely issue is that the edge function needs to be deployed!