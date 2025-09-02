# 🔄 Task Status Update API

## Overview
This API endpoint allows you to update the status of tasks using your API key. It supports all task status transitions with proper validation and logging.

## Endpoint
```
PATCH/PUT https://your-project.supabase.co/functions/v1/update-task-status
```

## Authentication
Include your API key in the request headers:
```
X-API-Key: your_api_key_here
```

**Note:** Your API key must have `write:tasks` or `update:tasks` permissions.

## Request Format

### Method
- `PATCH` (recommended)
- `PUT` (also supported)

### Headers
```
X-API-Key: tmp_QZ09tcj8g9k5Vf5TQ3vxhLUJWs48Rt2y
Content-Type: application/json
```

### Request Body
```json
{
  "task_id": "uuid-of-the-task",
  "status": "completed",
  "hours_worked": 8.5,
  "progress_percentage": 100,
  "notes": "Optional notes about the update"
}
```

#### Required Fields
- `task_id` (string): UUID of the task to update
- `status` (string): New status for the task

#### Optional Fields
- `hours_worked` (number): Hours worked on the task
- `progress_percentage` (number): Progress percentage (0-100)
- `notes` (string): Notes about the update

#### Valid Status Values
- `todo` - Task is pending
- `in_progress` - Task is being worked on
- `review` - Task is in testing/review
- `completed` - Task is finished
- `hold` - Task is on hold
- `archived` - Task is archived

## Examples

### 1. Mark Task as Completed
```bash
curl -X PATCH \
  -H "X-API-Key: tmp_QZ09tcj8g9k5Vf5TQ3vxhLUJWs48Rt2y" \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "123e4567-e89b-12d3-a456-426614174000",
    "status": "completed",
    "hours_worked": 8.5
  }' \
  "https://trhcrteklsoeoqrfsxlp.supabase.co/functions/v1/update-task-status"
```

### 2. Move Task to In Progress
```bash
curl -X PATCH \
  -H "X-API-Key: tmp_QZ09tcj8g9k5Vf5TQ3vxhLUJWs48Rt2y" \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "123e4567-e89b-12d3-a456-426614174000",
    "status": "in_progress",
    "progress_percentage": 30
  }' \
  "https://trhcrteklsoeoqrfsxlp.supabase.co/functions/v1/update-task-status"
```

### 3. Archive Task
```bash
curl -X PATCH \
  -H "X-API-Key: tmp_QZ09tcj8g9k5Vf5TQ3vxhLUJWs48Rt2y" \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "123e4567-e89b-12d3-a456-426614174000",
    "status": "archived",
    "notes": "Task no longer needed"
  }' \
  "https://trhcrteklsoeoqrfsxlp.supabase.co/functions/v1/update-task-status"
```

## Response Format

### Success Response (200)
```json
{
  "success": true,
  "message": "Task status updated successfully",
  "data": {
    "task_id": "123e4567-e89b-12d3-a456-426614174000",
    "previous_status": "in_progress",
    "new_status": "completed",
    "progress_percentage": 100,
    "hours_worked": 8.5,
    "updated_at": "2025-01-07T12:00:00Z"
  },
  "meta": {
    "timestamp": "2025-01-07T12:00:00Z",
    "api_version": "1.0"
  }
}
```

### Error Responses

#### 401 - Missing API Key
```json
{
  "error": "API key required. Provide X-API-Key header or Authorization: Bearer <key>",
  "code": "MISSING_API_KEY"
}
```

#### 401 - Invalid API Key
```json
{
  "error": "Invalid or expired API key",
  "code": "INVALID_API_KEY"
}
```

#### 403 - Insufficient Permissions
```json
{
  "error": "API key does not have write permissions for tasks",
  "code": "INSUFFICIENT_PERMISSIONS"
}
```

#### 400 - Missing Required Fields
```json
{
  "error": "Missing required fields: task_id and status are required",
  "code": "MISSING_REQUIRED_FIELDS",
  "required_fields": ["task_id", "status"]
}
```

#### 400 - Invalid Status
```json
{
  "error": "Invalid status. Must be one of: todo, in_progress, review, completed, hold, archived",
  "code": "INVALID_STATUS",
  "valid_statuses": ["todo", "in_progress", "review", "completed", "hold", "archived"]
}
```

#### 404 - Task Not Found
```json
{
  "error": "Task not found",
  "code": "TASK_NOT_FOUND"
}
```

#### 429 - Rate Limited
```json
{
  "error": "Rate limit exceeded: 60 requests per minute",
  "code": "RATE_LIMIT_EXCEEDED"
}
```

## Automatic Behavior

### Status Transitions
- **Moving to `completed`**: Automatically sets `completed_on` date and `progress_percentage` to 100
- **Moving from `completed`**: Clears `completed_on` date
- **Moving to `archived`**: Stores previous status and sets `archived_at` timestamp
- **Moving from `archived`**: Restores from archive, clears `archived_at`

### Progress Percentage
If not explicitly provided, progress is automatically set based on status:
- `todo`: 0%
- `in_progress`: 30%
- `review`: 80%
- `completed`: 100%
- `hold`: Keeps current progress
- `archived`: Keeps current progress

## Rate Limits
- Default: 60 requests per minute per API key
- Rate limits can be configured per API key in the dashboard

## Permissions Required
Your API key must have one of these permissions:
- `write:tasks`
- `update:tasks`

## Postman Collection
You can import this into Postman for easy testing:

```json
{
  "info": {
    "name": "Task Management API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Update Task Status",
      "request": {
        "method": "PATCH",
        "header": [
          {
            "key": "X-API-Key",
            "value": "tmp_QZ09tcj8g9k5Vf5TQ3vxhLUJWs48Rt2y"
          },
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"task_id\": \"123e4567-e89b-12d3-a456-426614174000\",\n  \"status\": \"completed\",\n  \"hours_worked\": 8.5\n}"
        },
        "url": {
          "raw": "https://trhcrteklsoeoqrfsxlp.supabase.co/functions/v1/update-task-status",
          "protocol": "https",
          "host": ["trhcrteklsoeoqrfsxlp", "supabase", "co"],
          "path": ["functions", "v1", "update-task-status"]
        }
      }
    }
  ]
}
```

## Security Notes
- All API calls are logged with timestamps, IP addresses, and response times
- Rate limiting prevents abuse
- API keys can be revoked or expired as needed
- Only tasks that exist in the database can be updated
- All updates are validated before being applied

## Support
If you encounter issues:
1. Check that your API key has the correct permissions
2. Verify the task UUID exists in the database
3. Ensure the status value is valid
4. Check the API usage logs in the dashboard for detailed error information