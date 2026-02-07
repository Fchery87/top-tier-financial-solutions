const getApiBase = () => {
  if (typeof window === 'undefined') {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://127.0.0.1:3000');
    return `${baseUrl}/api`;
  }
  return '/api';
};

export interface ContactFormData {
  full_name: string;
  email: string;
  phone_number?: string;
  message?: string;
}

export interface ContactFormResponse {
  id: string;
  message: string;
}

export interface Testimonial {
  id: string;
  author_name: string;
  author_location: string | null;
  quote: string;
  created_at: string;
  updated_at: string;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  display_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface Disclaimer {
  id: string;
  name: string;
  content: string;
  display_hint: string | null;
  created_at: string;
  updated_at: string;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: 'Request failed' })) as { detail?: string; error?: string; message?: string };
    throw new ApiError(response.status, error.detail || error.error || error.message || 'Request failed');
  }
  return response.json();
}

export async function submitContactForm(data: ContactFormData): Promise<ContactFormResponse> {
  const response = await fetch(`${getApiBase()}/public/contact-forms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<ContactFormResponse>(response);
}

export async function getTestimonials(): Promise<Testimonial[]> {
  const response = await fetch(`${getApiBase()}/public/testimonials`, {
    cache: 'no-store',
  });
  return handleResponse<Testimonial[]>(response);
}

export async function getFAQs(): Promise<FAQ[]> {
  const response = await fetch(`${getApiBase()}/public/faqs`, {
    cache: 'no-store',
  });
  return handleResponse<FAQ[]>(response);
}

export async function getDisclaimers(): Promise<Disclaimer[]> {
  const response = await fetch(`${getApiBase()}/public/disclaimers`, {
    cache: 'no-store',
  });
  return handleResponse<Disclaimer[]>(response);
}
