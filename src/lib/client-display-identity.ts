import { decryptClientData } from '@/lib/db-encryption';

type ClientDisplayIdentityInput = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
};

export function formatClientDisplayIdentity(input: ClientDisplayIdentityInput) {
  const decrypted = decryptClientData({
    firstName: input.firstName || '',
    lastName: input.lastName || '',
  });
  const firstName = String(decrypted.firstName || '').trim();
  const lastName = String(decrypted.lastName || '').trim();
  const clientName = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown Client';

  return {
    client_name: clientName,
    client_email: input.email,
  };
}
