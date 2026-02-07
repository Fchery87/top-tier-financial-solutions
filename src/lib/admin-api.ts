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

// Types
export interface Page {
  id: string;
  slug: string;
  title: string;
  hero_headline: string | null;
  hero_subheadline: string | null;
  main_content_json: string | null;
  cta_text: string | null;
  cta_link: string | null;
  meta_title: string | null;
  meta_description: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface Testimonial {
  id: string;
  author_name: string;
  author_location: string | null;
  quote: string;
  order_index: number;
  is_approved: boolean;
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
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export type ConsultationStatus = 'new' | 'contacted' | 'qualified' | 'archived';

export interface ContactFormSubmission {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  message: string | null;
  source_page_slug: string | null;
  status: ConsultationStatus;
  requested_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export class AdminApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'AdminApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: 'Request failed' })) as { detail?: string; error?: string; message?: string };
    throw new AdminApiError(response.status, error.detail || error.error || error.message || 'Request failed');
  }
  return response.json();
}

function getAuthHeaders(token: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

// Pages API
export async function getPages(token: string, page = 1, limit = 10): Promise<PaginatedResponse<Page>> {
  const response = await fetch(`${getApiBase()}/admin/pages?page=${page}&limit=${limit}`, {
    headers: getAuthHeaders(token),
  });
  return handleResponse<PaginatedResponse<Page>>(response);
}

export async function createPage(token: string, data: Partial<Page>): Promise<Page> {
  const response = await fetch(`${getApiBase()}/admin/pages`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse<Page>(response);
}

export async function updatePage(token: string, id: string, data: Partial<Page>): Promise<Page> {
  const response = await fetch(`${getApiBase()}/admin/pages/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse<Page>(response);
}

export async function deletePage(token: string, id: string): Promise<void> {
  const response = await fetch(`${getApiBase()}/admin/pages/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(token),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Delete failed' }));
    throw new AdminApiError(response.status, error.detail || 'Delete failed');
  }
}

// Testimonials API
export async function getTestimonials(token: string, page = 1, limit = 10): Promise<PaginatedResponse<Testimonial>> {
  const response = await fetch(`${getApiBase()}/admin/testimonials?page=${page}&limit=${limit}`, {
    headers: getAuthHeaders(token),
  });
  return handleResponse<PaginatedResponse<Testimonial>>(response);
}

export async function createTestimonial(token: string, data: Partial<Testimonial>): Promise<Testimonial> {
  const response = await fetch(`${getApiBase()}/admin/testimonials`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse<Testimonial>(response);
}

export async function updateTestimonial(token: string, id: string, data: Partial<Testimonial>): Promise<Testimonial> {
  const response = await fetch(`${getApiBase()}/admin/testimonials/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse<Testimonial>(response);
}

export async function deleteTestimonial(token: string, id: string): Promise<void> {
  const response = await fetch(`${getApiBase()}/admin/testimonials/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(token),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Delete failed' }));
    throw new AdminApiError(response.status, error.detail || 'Delete failed');
  }
}

// FAQs API
export async function getFAQs(token: string, page = 1, limit = 10): Promise<PaginatedResponse<FAQ>> {
  const response = await fetch(`${getApiBase()}/admin/faqs?page=${page}&limit=${limit}`, {
    headers: getAuthHeaders(token),
  });
  return handleResponse<PaginatedResponse<FAQ>>(response);
}

export async function createFAQ(token: string, data: Partial<FAQ>): Promise<FAQ> {
  const response = await fetch(`${getApiBase()}/admin/faqs`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse<FAQ>(response);
}

export async function updateFAQ(token: string, id: string, data: Partial<FAQ>): Promise<FAQ> {
  const response = await fetch(`${getApiBase()}/admin/faqs/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse<FAQ>(response);
}

export async function deleteFAQ(token: string, id: string): Promise<void> {
  const response = await fetch(`${getApiBase()}/admin/faqs/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(token),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Delete failed' }));
    throw new AdminApiError(response.status, error.detail || 'Delete failed');
  }
}

// Disclaimers API
export async function getDisclaimers(token: string, page = 1, limit = 10): Promise<PaginatedResponse<Disclaimer>> {
  const response = await fetch(`${getApiBase()}/admin/disclaimers?page=${page}&limit=${limit}`, {
    headers: getAuthHeaders(token),
  });
  return handleResponse<PaginatedResponse<Disclaimer>>(response);
}

export async function createDisclaimer(token: string, data: Partial<Disclaimer>): Promise<Disclaimer> {
  const response = await fetch(`${getApiBase()}/admin/disclaimers`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse<Disclaimer>(response);
}

export async function updateDisclaimer(token: string, id: string, data: Partial<Disclaimer>): Promise<Disclaimer> {
  const response = await fetch(`${getApiBase()}/admin/disclaimers/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse<Disclaimer>(response);
}

export async function deleteDisclaimer(token: string, id: string): Promise<void> {
  const response = await fetch(`${getApiBase()}/admin/disclaimers/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(token),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Delete failed' }));
    throw new AdminApiError(response.status, error.detail || 'Delete failed');
  }
}

// Contact Forms / Leads API
export async function getContactForms(
  token: string, 
  page = 1, 
  limit = 10, 
  status?: ConsultationStatus
): Promise<PaginatedResponse<ContactFormSubmission>> {
  let url = `${getApiBase()}/admin/leads?page=${page}&limit=${limit}`;
  if (status) {
    url += `&status=${status}`;
  }
  const response = await fetch(url, {
    headers: getAuthHeaders(token),
  });
  return handleResponse<PaginatedResponse<ContactFormSubmission>>(response);
}

export async function getContactForm(token: string, id: string): Promise<ContactFormSubmission> {
  const response = await fetch(`${getApiBase()}/admin/leads/${id}`, {
    headers: getAuthHeaders(token),
  });
  return handleResponse<ContactFormSubmission>(response);
}

export async function updateContactFormStatus(
  token: string, 
  id: string, 
  status: ConsultationStatus
): Promise<ContactFormSubmission> {
  const response = await fetch(`${getApiBase()}/admin/leads/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ status }),
  });
  return handleResponse<ContactFormSubmission>(response);
}

export async function deleteContactForm(token: string, id: string): Promise<void> {
  const response = await fetch(`${getApiBase()}/admin/leads/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(token),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Delete failed' }));
    throw new AdminApiError(response.status, error.detail || 'Delete failed');
  }
}
