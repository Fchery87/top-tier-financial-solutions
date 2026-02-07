import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  getDisclaimers,
  getFAQs,
  getTestimonials,
  submitContactForm,
} from '@/lib/api';

const fetchMock = vi.fn();

describe('public api client', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('submits contact forms to Next public endpoint', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'req-1', message: 'Contact form submitted successfully' }),
    });

    await submitContactForm({
      full_name: 'Jane Doe',
      email: 'jane@example.com',
      message: 'Need help',
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/public/contact-forms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Jane Doe',
        email: 'jane@example.com',
        message: 'Need help',
      }),
    });
  });

  it('uses Next public endpoints for content fetches', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });

    await getTestimonials();
    await getFAQs();
    await getDisclaimers();

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/public/testimonials', { cache: 'no-store' });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/public/faqs', { cache: 'no-store' });
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/public/disclaimers', { cache: 'no-store' });
  });

  it('uses error field when detail is not present', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid request' }),
    });

    await expect(
      submitContactForm({ full_name: 'Jane Doe', email: 'jane@example.com' })
    ).rejects.toEqual(new ApiError(400, 'Invalid request'));
  });
});
