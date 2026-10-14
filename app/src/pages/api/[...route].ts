import type { APIRoute } from 'astro';
import { api } from '../../api';

const handle: APIRoute = ({ request }) => api.fetch(request);

export const prerender = false;
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
