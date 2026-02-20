/**
 * API client for DevSage web app.
 * Uses the existing apiRequest pattern (with cookie-based auth and silent refresh).
 * Hono RPC types are not imported directly — @devsage/api is not a frontend dependency.
 */
export { apiRequest, ApiError } from './api.js';
