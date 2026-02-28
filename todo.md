# World Cup 2026 SaaS Dashboard - TODO

## Backend - Database & Schema
- [x] Extend schema with GameSubmission table (userId, matchResults, status, createdAt, updatedAt)
- [x] Add custom user table with username, email, password (bcrypt), role fields
- [x] Create database migrations

## Backend - Authentication
- [x] Implement registration endpoint with email/username/password validation
- [x] Implement login endpoint with JWT token generation
- [x] Add JWT middleware for protected routes
- [x] Implement password hashing with bcrypt
- [x] Add logout endpoint
- [x] Create admin user seeding (Yoven / Adir8043120)

## Backend - Game Form API
- [x] Create POST endpoint to submit game form (protected)
- [x] Create GET endpoint to fetch all submissions with status
- [x] Add validation for form data
- [x] Add user association to submissions

## Backend - Admin API
- [x] Create GET endpoint to fetch all pending submissions (admin only)
- [x] Create POST endpoint to approve submission (admin only)
- [x] Create POST endpoint to reject submission (admin only)
- [x] Add admin role verification middleware

## Backend - Payment Management (Admin)
- [x] Create payment status field in submissions (pending/paid/unpaid)
- [x] Add endpoint for admin to mark payment as received
- [x] Link payment status to form approval workflow

## Frontend - Authentication Pages
- [x] Create registration page with email/username/password fields
- [x] Create login page with username/password fields
- [x] Add form validation and error handling
- [x] Implement JWT token storage and management
- [x] Add logout functionality

## Frontend - Dashboard
- [x] Create main dashboard layout with navigation
- [x] Display all submitted forms in table format
- [x] Add status indicators (green for approved, orange for pending)
- [x] Show user info and logout button
- [x] Add responsive design

## Frontend - Game Form Submission
- [x] Create game form modal/page with match prediction fields
- [x] Add form validation
- [x] Implement form submission with loading state
- [x] Show success/error messages
- [x] Auto-populate username field

## Frontend - Admin Panel
- [x] Create admin panel at /admin route
- [x] Display pending submissions
- [x] Add approve/reject buttons with confirmation
- [x] Add payment status management (mark as paid/unpaid)
- [x] Show submission details
- [x] Add admin-only navigation
- [x] Implement protected route for admin access

## Frontend - Protected Routes
- [x] Create ProtectedRoute component for authenticated pages
- [x] Create AdminRoute component for admin-only pages
- [x] Redirect unauthenticated users to login
- [x] Redirect non-admin users from /admin to home

## Security
- [x] Add XSS prevention (sanitize inputs)
- [x] Add CSRF protection
- [x] Implement JWT expiration and refresh
- [x] Add rate limiting for auth endpoints
- [x] Validate all API inputs on backend

## Testing
- [x] Write vitest tests for auth endpoints
- [x] Write vitest tests for game form endpoints
- [x] Write vitest tests for admin endpoints
- [x] Test protected routes
- [x] Test admin role verification
## UI/UX Polish

- [x] Add loading states and spinners
- [x] Add toast notifications for actions
- [x] Add empty states for tables
- [x] Ensure responsive design on mobile
- [x] Add keyboard accessibility
